-- 0012_household_roles.sql — Household roles: owner, adult, assistant (ADR-026)
--
-- Before: the owner managed people; every other member could do everything
-- else, including removing homes, vehicles, upkeep and meal plans.
--
-- After:
--   owner      everything (one per household, set when the household is made)
--   adult      everything except people, roles, invites and household settings
--   assistant  tasks (see, add, complete, assign; delete only their own),
--              grocery list, view homes/vehicles/upkeep and mark upkeep done,
--              view meal plans; no changes to homes, vehicles, upkeep
--              schedules, meal plans or nutrition preferences
-- Notifications stay per person. Removing a member ends access on their next
-- request (RLS is checked on every query).
--
-- Enforcement is in the database: RLS per command, plus two guards:
--   * household_members: roles can only be 'adult' or 'assistant' for people
--     the owner adds or changes; the owner row can't be changed or created.
--   * home_maintenance_items: a non-adult may change only last_done/next_due
--     (mark done). Database triggers (security definer) are not limited.
-- Existing 'member' rows become 'adult' (no one loses access).

begin;

-- 1. Roles in use -------------------------------------------------------------
update public.household_members set role = 'adult' where role = 'member';
alter table public.household_members alter column role set default 'adult';

alter table public.household_invites drop constraint if exists household_invites_role_check;
update public.household_invites set role = 'adult' where role = 'member';
alter table public.household_invites alter column role set default 'adult';
alter table public.household_invites add constraint household_invites_role_check
  check (role in ('adult', 'assistant'));

-- 2. Helper: owner or adult ----------------------------------------------------
create or replace function public.is_household_adult(h uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.household_members
                 where household_id = h and user_id = auth.uid() and role in ('owner', 'adult'))
$$;
revoke all on function public.is_household_adult(uuid) from public, anon;
grant execute on function public.is_household_adult(uuid) to authenticated, service_role;

-- 3. Guard: who may hold which role ---------------------------------------------
create or replace function public.household_members_role_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Only browser sessions are limited; the owner trigger and the invite
  -- function (service role) set roles themselves.
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.role = 'owner' and new.role <> 'owner' then
      raise exception 'The household owner''s role can''t be changed.' using errcode = '42501';
    end if;
    if old.role = 'owner' then
      return new;   -- the owner may edit their own name, not their role
    end if;
    if new.household_id <> old.household_id or new.user_id <> old.user_id then
      raise exception 'Members can''t be moved.' using errcode = '42501';
    end if;
  end if;
  if new.role not in ('adult', 'assistant') then
    raise exception 'A member can be an adult or an assistant.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists household_members_role_guard on public.household_members;
create trigger household_members_role_guard
  before insert or update on public.household_members
  for each row execute function public.household_members_role_guard();

-- 4. Guard: assistants may only mark upkeep done --------------------------------
create or replace function public.home_items_assistant_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user <> 'authenticated' or public.is_household_adult(old.household_id) then
    return new;
  end if;
  if (new.household_id, new.asset_id, new.template_key, new.title, new.every_days, new.is_renewal, new.lead_days, new.active)
     is distinct from
     (old.household_id, old.asset_id, old.template_key, old.title, old.every_days, old.is_renewal, old.lead_days, old.active) then
    raise exception 'Assistants can mark upkeep done, but not change the schedule.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists home_items_assistant_guard on public.home_maintenance_items;
create trigger home_items_assistant_guard
  before update on public.home_maintenance_items
  for each row execute function public.home_items_assistant_guard();

-- 5. Policies: read for every member, write by role ------------------------------
-- Homes and vehicles
drop policy if exists "household_assets member access" on public.household_assets;
create policy "household_assets member read" on public.household_assets
  for select to authenticated using (public.is_household_member(household_id));
create policy "household_assets adult insert" on public.household_assets
  for insert to authenticated with check (public.is_household_adult(household_id));
create policy "household_assets adult update" on public.household_assets
  for update to authenticated using (public.is_household_adult(household_id)) with check (public.is_household_adult(household_id));
create policy "household_assets adult delete" on public.household_assets
  for delete to authenticated using (public.is_household_adult(household_id));

-- Upkeep: everyone may mark done (guard above); adults add and remove
drop policy if exists "home_maintenance_items member access" on public.home_maintenance_items;
create policy "home_maintenance_items member read" on public.home_maintenance_items
  for select to authenticated using (public.is_household_member(household_id));
create policy "home_maintenance_items adult insert" on public.home_maintenance_items
  for insert to authenticated with check (public.is_household_adult(household_id));
create policy "home_maintenance_items member update" on public.home_maintenance_items
  for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "home_maintenance_items adult delete" on public.home_maintenance_items
  for delete to authenticated using (public.is_household_adult(household_id));

-- Tasks: everyone sees, adds, completes and assigns; delete adults or the creator
drop policy if exists "household_tasks member access" on public.household_tasks;
create policy "household_tasks member read" on public.household_tasks
  for select to authenticated using (public.is_household_member(household_id));
create policy "household_tasks member insert" on public.household_tasks
  for insert to authenticated with check (public.is_household_member(household_id));
create policy "household_tasks member update" on public.household_tasks
  for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "household_tasks adult or creator delete" on public.household_tasks
  for delete to authenticated using (public.is_household_adult(household_id) or (created_by = auth.uid() and public.is_household_member(household_id)));

-- Meal plans and nutrition preferences: everyone reads, adults change
drop policy if exists "household_meal_plans member access" on public.household_meal_plans;
create policy "household_meal_plans member read" on public.household_meal_plans
  for select to authenticated using (public.is_household_member(household_id));
create policy "household_meal_plans adult write" on public.household_meal_plans
  for all to authenticated using (public.is_household_adult(household_id)) with check (public.is_household_adult(household_id));

drop policy if exists "household_nutrition_prefs member access" on public.household_nutrition_prefs;
create policy "household_nutrition_prefs member read" on public.household_nutrition_prefs
  for select to authenticated using (public.is_household_member(household_id));
create policy "household_nutrition_prefs adult write" on public.household_nutrition_prefs
  for all to authenticated using (public.is_household_adult(household_id)) with check (public.is_household_adult(household_id));

-- Grocery lists, notifications, members and invites keep their policies.

commit;
