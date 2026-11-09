-- Home Genie: upkeep per home and vehicle, with renewals. Not yet applied:
-- waiting on the SQL-editor dry run. Apply after 0010.
--
-- Target: GenieSphere project (nxgtefbqizvihwikqnaw, ADR-015). ADR-020.
--
--   * household_assets: the household's homes/properties and vehicles, each
--     Homes are the ones the family lives in (always personal); vehicles
--     are personal or business, with an optional "owned by" label. Rentals
--     and business property belong elsewhere (ADR-021).
--   * home_maintenance_items.asset_id: which one an item belongs to. Existing
--     items move to a "Main house" created for their household.
--   * Renewals (registration, insurance, emissions): is_renewal, and a longer
--     lead time (lead_days, default 7) before the task appears. Completing a
--     renewal moves its date on by one period from the expiry date, not today.
--   * Task titles name the asset: "Oil change · F-150".
--   * Removing an asset stops its upkeep (and deletes its open tasks).

begin;

-- 1. Homes and vehicles.
create table if not exists public.household_assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null check (kind in ('place', 'vehicle')),
  name text not null check (length(btrim(name)) between 1 and 60),
  description text check (description is null or length(description) <= 80),
  usage text not null default 'personal' check (usage in ('personal', 'business')),
  owner_label text check (owner_label is null or length(owner_label) <= 80),
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  check (kind = 'vehicle' or (usage = 'personal' and owner_label is null))
);
create index if not exists household_assets_household_idx on public.household_assets (household_id) where active;

alter table public.household_assets enable row level security;
create policy "household_assets member access" on public.household_assets
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
revoke all on public.household_assets from anon;
-- No delete: removing is "active = false", so open tasks are cleaned up.
grant select, insert, update on public.household_assets to authenticated;

-- 2. Items belong to an asset of the same household; renewals.
alter table public.home_maintenance_items
  add column if not exists asset_id uuid,
  add column if not exists is_renewal boolean not null default false,
  add column if not exists lead_days integer not null default 7 check (lead_days between 7 and 60);
alter table public.home_maintenance_items drop constraint if exists home_maintenance_items_asset_fk;
alter table public.home_maintenance_items
  add constraint home_maintenance_items_asset_fk foreign key (asset_id, household_id)
  references public.household_assets (id, household_id) on delete cascade;
create index if not exists home_maintenance_items_asset_idx on public.home_maintenance_items (asset_id);

-- Existing items: one "Main house" per household that has any.
insert into public.household_assets (household_id, kind, name, usage, created_by)
select distinct i.household_id, 'place', 'Main house', 'personal', null::uuid
  from public.home_maintenance_items i
 where i.asset_id is null
   and not exists (select 1 from public.household_assets a where a.household_id = i.household_id);
update public.home_maintenance_items i
   set asset_id = a.id
  from public.household_assets a
 where i.asset_id is null and a.household_id = i.household_id and a.kind = 'place' and a.name = 'Main house';

-- 3. Sync: lead time per item, asset name in the task title.
create or replace function public.home_sync_tasks(p_household uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  today date := (now() at time zone 'America/Chicago')::date;
  created integer := 0;
begin
  -- Removed items: drop their open task.
  delete from public.household_tasks t
   using public.home_maintenance_items i
   where t.source_ref = 'home:' || i.id and t.completed_at is null
     and not i.active and (p_household is null or i.household_id = p_household);

  -- Done early (next due moved past its lead time): close the open task.
  update public.household_tasks t
     set status = 'done', completed_at = now(), updated_at = now()
    from public.home_maintenance_items i
   where t.source_ref = 'home:' || i.id and t.completed_at is null
     and i.active and i.next_due > today + i.lead_days and (p_household is null or i.household_id = p_household);

  -- Coming up: one open task per item, "Item · Asset".
  insert into public.household_tasks (household_id, title, due_at, status, source_module, source_ref, created_by)
  select i.household_id, i.title || coalesce(' · ' || a.name, ''), (i.next_due + time '12:00') at time zone 'UTC',
         'todo', 'home', 'home:' || i.id, i.created_by
    from public.home_maintenance_items i
    left join public.household_assets a on a.id = i.asset_id
   where i.active and i.next_due <= today + i.lead_days and (p_household is null or i.household_id = p_household)
     and not exists (select 1 from public.household_tasks t where t.source_ref = 'home:' || i.id and t.completed_at is null)
  on conflict do nothing;
  get diagnostics created = row_count;
  return created;
end $$;
revoke all on function public.home_sync_tasks(uuid) from public, anon, authenticated;
grant execute on function public.home_sync_tasks(uuid) to service_role;

-- 4. Completing a renewal moves it on from its expiry date.
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
       set last_done = done_day,
           next_due = case when i.is_renewal
             then i.next_due + i.every_days * greatest(1, floor((done_day - i.next_due)::numeric / i.every_days)::int + 1)
             else done_day + i.every_days end,
           updated_at = now()
     where 'home:' || i.id = new.source_ref and i.household_id = new.household_id;
  else
    update public.home_maintenance_items i
       set next_due = coalesce((new.due_at at time zone 'UTC')::date, (now() at time zone 'America/Chicago')::date), updated_at = now()
     where 'home:' || i.id = new.source_ref and i.household_id = new.household_id and i.active;
  end if;
  return null;
end $$;
revoke all on function public.home_task_completed() from public, anon, authenticated;

-- 5. Removing an asset stops its upkeep (the items trigger then drops open tasks).
create or replace function public.home_asset_removed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.home_maintenance_items set active = false, updated_at = now()
   where asset_id = new.id and household_id = new.household_id and active;
  return null;
end $$;
revoke all on function public.home_asset_removed() from public, anon, authenticated;

drop trigger if exists household_assets_removed on public.household_assets;
create trigger household_assets_removed
  after update of active on public.household_assets
  for each row when (old.active and not new.active)
  execute function public.home_asset_removed();

-- 6. Open tasks of existing items get the asset name now.
update public.household_tasks t
   set title = i.title || ' · ' || a.name, updated_at = now()
  from public.home_maintenance_items i
  join public.household_assets a on a.id = i.asset_id
 where t.source_ref = 'home:' || i.id and t.completed_at is null and t.title = i.title;

commit;
