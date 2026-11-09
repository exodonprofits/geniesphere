-- Core notifications 0.1: in-app inbox, "assigned to you" and a weekly summary
-- by email. Not yet applied: waiting on the SQL-editor dry run.
--
-- Target: GenieSphere project (nxgtefbqizvihwikqnaw, ADR-015). ADR-019.
--
-- How it works:
--   * household_notifications rows are per person (user_id set) and are only
--     created by the database or the gs-notify Edge Function. Browsers can
--     read their own and set read_at, nothing else.
--   * Assigning a task to someone else creates their notification
--     (kind 'task_assigned', email_status 'pending').
--   * pg_cron calls gs-notify every 5 minutes with a secret kept in Vault. The
--     function emails pending notifications (if the person wants them) and,
--     on Sunday from 5 PM Chicago time, each member's weekly summary.
--   * notification_prefs: one row per member and household; a missing row
--     means both emails on.

begin;

-- 1. Notifications: what kind, where it links, a dedupe key, email state.
alter table public.household_notifications
  add column if not exists kind text check (kind is null or kind ~ '^[a-z_]{1,40}$'),
  add column if not exists link text check (link is null or link ~ '^/[A-Za-z0-9/_.#?=&-]{0,200}$'),
  add column if not exists ref text check (ref is null or length(ref) <= 120),
  add column if not exists email_status text check (email_status is null or email_status in ('pending', 'sending', 'sent', 'skipped', 'failed'));
create unique index if not exists household_notifications_user_ref_idx
  on public.household_notifications (user_id, ref) where ref is not null;
create index if not exists household_notifications_user_created_idx
  on public.household_notifications (user_id, created_at desc);
create index if not exists household_notifications_pending_idx
  on public.household_notifications (created_at) where email_status = 'pending';

-- Browsers read and mark read; they no longer create or edit notifications.
drop policy if exists "notifications insert" on public.household_notifications;
revoke all on public.household_notifications from anon;
revoke insert, update, delete, truncate, references, trigger on public.household_notifications from authenticated;
grant select on public.household_notifications to authenticated;
grant update (read_at) on public.household_notifications to authenticated;

-- 2. Email preferences.
create table if not exists public.notification_prefs (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  weekly_digest boolean not null default true,
  assigned_email boolean not null default true,
  last_digest_on date,
  last_test_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
alter table public.notification_prefs enable row level security;
create policy "notification_prefs own row" on public.notification_prefs
  for all to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id))
  with check (user_id = auth.uid() and public.is_household_member(household_id));
revoke all on public.notification_prefs from anon, authenticated;
grant select on public.notification_prefs to authenticated;
grant insert (household_id, user_id, weekly_digest, assigned_email, updated_at) on public.notification_prefs to authenticated;
-- household_id/user_id are included so upsert works; RLS keeps them to your own membership.
grant update (household_id, user_id, weekly_digest, assigned_email, updated_at) on public.notification_prefs to authenticated;

-- 3. Assigning a task to someone else notifies them. Reassigning back to the
-- same person re-raises the same notification instead of adding another.
create or replace function public.notify_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  who text;
begin
  if new.assigned_to is null or new.completed_at is not null then return null; end if;
  if new.assigned_to = auth.uid() then return null; end if;
  if tg_op = 'UPDATE' and old.assigned_to is not distinct from new.assigned_to then return null; end if;
  if not exists (select 1 from public.household_members m where m.household_id = new.household_id and m.user_id = new.assigned_to) then
    return null;
  end if;
  select coalesce(nullif(btrim(m.display_name), ''), split_part(m.email, '@', 1))
    into who from public.household_members m
   where m.household_id = new.household_id and m.user_id = auth.uid();

  insert into public.household_notifications (household_id, user_id, source_module, kind, title, body, link, ref, email_status)
  values (new.household_id, new.assigned_to, coalesce(new.source_module, 'tasks'), 'task_assigned',
          left(coalesce(who, 'Someone'), 40) || ' assigned you: ' || left(new.title, 150),
          case when new.due_at is null then null
               else 'Due ' || to_char((new.due_at at time zone 'UTC')::date, 'Dy, Mon FMDD') end,
          '/core/tasks/index.html', 'assign:' || new.id, 'pending')
  on conflict (user_id, ref) where ref is not null do update
    set title = excluded.title, body = excluded.body, read_at = null, created_at = now(), email_status = 'pending';
  return null;
end $$;
revoke all on function public.notify_task_assigned() from public, anon, authenticated;

drop trigger if exists household_tasks_notify_assigned on public.household_tasks;
create trigger household_tasks_notify_assigned
  after insert or update of assigned_to on public.household_tasks
  for each row execute function public.notify_task_assigned();

-- 4. Server helpers for gs-notify (service role only).
-- Claim this week's summary for one member, once.
create or replace function public.gs_notify_claim_digest(p_household uuid, p_user uuid, p_day date)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claimed int;
begin
  insert into public.notification_prefs (household_id, user_id, last_digest_on)
  values (p_household, p_user, p_day)
  on conflict (household_id, user_id) do update
    set last_digest_on = excluded.last_digest_on
    where notification_prefs.last_digest_on is distinct from excluded.last_digest_on;
  get diagnostics claimed = row_count;
  return claimed > 0;
end $$;

-- Allow a "send me the summary now" test at most every 10 minutes.
create or replace function public.gs_notify_claim_test(p_household uuid, p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claimed int;
begin
  insert into public.notification_prefs (household_id, user_id, last_test_at)
  values (p_household, p_user, now())
  on conflict (household_id, user_id) do update
    set last_test_at = now()
    where notification_prefs.last_test_at is null or notification_prefs.last_test_at < now() - interval '10 minutes';
  get diagnostics claimed = row_count;
  return claimed > 0;
end $$;

-- The cron call proves itself with a random secret that never leaves the database.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'gs_notify_cron_secret', 'gs-notify cron call (0010)')
 where not exists (select 1 from vault.secrets where name = 'gs_notify_cron_secret');

create or replace function public.gs_notify_cron_ok(p_secret text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(length(p_secret) = 64 and exists (
    select 1 from vault.decrypted_secrets where name = 'gs_notify_cron_secret' and decrypted_secret = p_secret), false)
$$;

revoke all on function public.gs_notify_claim_digest(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.gs_notify_claim_test(uuid, uuid) from public, anon, authenticated;
revoke all on function public.gs_notify_cron_ok(text) from public, anon, authenticated;
grant execute on function public.gs_notify_claim_digest(uuid, uuid, date) to service_role;
grant execute on function public.gs_notify_claim_test(uuid, uuid) to service_role;
grant execute on function public.gs_notify_cron_ok(text) to service_role;

-- 5. Every 5 minutes: gs-notify sends what is pending (and Sunday summaries).
-- The bearer token is the project's public anon key (same as app-config.js).
select cron.unschedule('gs-notify') where exists (select 1 from cron.job where jobname = 'gs-notify');
select cron.schedule('gs-notify', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://nxgtefbqizvihwikqnaw.supabase.co/functions/v1/gs-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54Z3RlZmJxaXp2aWh3aWtxbmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NzM5NjIsImV4cCI6MjEwOTU0OTk2Mn0.mHDoeUzaWn0tFF_wbNw9rAZhPDtAB6VAU07hfkXgApk',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'gs_notify_cron_secret')),
    body := '{"mode":"cron"}'::jsonb,
    timeout_milliseconds := 30000)
$cron$);

commit;
