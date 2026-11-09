-- Home Genie 0.1: recurring home maintenance that feeds the Core task list.
-- Not yet applied: waiting on the SQL-editor dry run.
--
-- Target: GenieSphere project (nxgtefbqizvihwikqnaw, ADR-015). ADR-018.
--
-- How it works (all in the database, so it happens even when nobody opens a page):
--   * home_maintenance_items: what the household tracks and how often.
--   * home_sync_tasks(): for every active item due within 7 days with no open
--     task, adds one household task (source_module 'home', source_ref
--     'home:<item id>'); an open task whose item was pushed out (done early) is
--     closed, and one whose item was removed is deleted.
--   * Runs after any item change, after a home task is completed, and daily
--     (pg_cron 11:05 UTC) for items that come due as time passes.
--   * Completing a home task, on any page, records the item done that day and
--     schedules the next one (last_done + every_days).

begin;

-- 1. Core tasks: a stable link back to the module record that created them.
alter table public.household_tasks
  add column if not exists source_ref text check (source_ref is null or length(source_ref) <= 100);
create unique index if not exists household_tasks_open_source_ref_idx
  on public.household_tasks (household_id, source_ref)
  where completed_at is null and source_ref is not null;

-- 2. Home Genie items.
create table if not exists public.home_maintenance_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  template_key text check (template_key is null or template_key ~ '^[a-z0-9_]{1,40}$'),
  title text not null check (length(btrim(title)) between 1 and 120),
  every_days integer not null check (every_days between 7 and 1825),
  next_due date not null,
  last_done date,
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists home_maintenance_items_due_idx on public.home_maintenance_items (household_id, next_due) where active;

alter table public.home_maintenance_items enable row level security;
create policy "home_maintenance_items member access" on public.home_maintenance_items
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
revoke all on public.home_maintenance_items from anon;
grant select, insert, update, delete on public.home_maintenance_items to authenticated;

-- 3. Keep tasks in step with items. p_household null = every household (cron).
create or replace function public.home_sync_tasks(p_household uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  horizon date := (now() at time zone 'America/Chicago')::date + 7;
  created integer := 0;
begin
  -- Removed items: drop their open task.
  delete from public.household_tasks t
   using public.home_maintenance_items i
   where t.source_ref = 'home:' || i.id and t.completed_at is null
     and not i.active and (p_household is null or i.household_id = p_household);

  -- Done early (next due moved past the horizon): close the open task.
  update public.household_tasks t
     set status = 'done', completed_at = now(), updated_at = now()
    from public.home_maintenance_items i
   where t.source_ref = 'home:' || i.id and t.completed_at is null
     and i.active and i.next_due > horizon and (p_household is null or i.household_id = p_household);

  -- Coming up: one open task per item.
  insert into public.household_tasks (household_id, title, due_at, status, source_module, source_ref, created_by)
  select i.household_id, i.title, (i.next_due + time '12:00') at time zone 'UTC', 'todo', 'home', 'home:' || i.id, i.created_by
    from public.home_maintenance_items i
   where i.active and i.next_due <= horizon and (p_household is null or i.household_id = p_household)
     and not exists (select 1 from public.household_tasks t where t.source_ref = 'home:' || i.id and t.completed_at is null)
  on conflict do nothing;
  get diagnostics created = row_count;
  return created;
end $$;

revoke all on function public.home_sync_tasks(uuid) from public, anon, authenticated;
grant execute on function public.home_sync_tasks(uuid) to service_role;

create or replace function public.home_items_after_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.home_sync_tasks(new.household_id);
  return null;
end $$;

drop trigger if exists home_items_sync on public.home_maintenance_items;
create trigger home_items_sync
  after insert or update on public.home_maintenance_items
  for each row execute function public.home_items_after_change();

-- A completed home task records the item done and schedules the next one;
-- undoing it (completed_at back to null) puts the item back on the task's due
-- date. Skipped when the change came from home_sync_tasks itself (depth > 1),
-- i.e. the item was already marked done on the Home page.
create or replace function public.home_task_completed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  done_day date := (coalesce(new.completed_at, now()) at time zone 'America/Chicago')::date;
begin
  if pg_trigger_depth() > 1 then return null; end if;
  if new.completed_at is not null then
    update public.home_maintenance_items i
       set last_done = done_day, next_due = done_day + i.every_days, updated_at = now()
     where 'home:' || i.id = new.source_ref and i.household_id = new.household_id;
  else
    update public.home_maintenance_items i
       set next_due = coalesce((new.due_at at time zone 'UTC')::date, (now() at time zone 'America/Chicago')::date), updated_at = now()
     where 'home:' || i.id = new.source_ref and i.household_id = new.household_id and i.active;
  end if;
  return null;
end $$;

drop trigger if exists home_task_done on public.household_tasks;
create trigger home_task_done
  after update of completed_at on public.household_tasks
  for each row
  when ((old.completed_at is null) <> (new.completed_at is null) and new.source_ref like 'home:%')
  execute function public.home_task_completed();

revoke all on function public.home_items_after_change() from public, anon, authenticated;
revoke all on function public.home_task_completed() from public, anon, authenticated;

-- 4. Daily pass for items that come due as time passes.
select cron.unschedule('home-sync-tasks') where exists (select 1 from cron.job where jobname = 'home-sync-tasks');
select cron.schedule('home-sync-tasks', '5 11 * * *', 'select public.home_sync_tasks(null)');

commit;
