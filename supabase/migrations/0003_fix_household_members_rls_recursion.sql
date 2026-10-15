-- Fix: "infinite recursion detected in policy for relation household_members" (42P17).
--
-- Four policies on public.household_members query household_members itself, so
-- any authenticated read of household_members errors, and so does every table
-- whose policy reads household_members (households, household_bills, _documents,
-- _events, _gifts, _tasks, _vehicles, vehicle_service_history).
--
-- The existing helpers already express the right checks; making them
-- SECURITY DEFINER lets policies call them without re-entering RLS. Both only
-- answer "is auth.uid() a member/owner of this household", so they expose no
-- other rows. search_path is pinned so the definer context cannot be hijacked.

create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = auth.uid()
      and hm.role = 'owner'
  );
$$;

-- anon keeps execute: households_read_for_members applies to anon, and for anon
-- auth.uid() is null so both helpers simply return false.
revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.is_household_owner(uuid) from public;
grant execute on function public.is_household_member(uuid) to anon, authenticated;
grant execute on function public.is_household_owner(uuid) to anon, authenticated;

-- Same rules as before, without the self-reference.
drop policy if exists "members can read household_members" on public.household_members;
create policy "members can read household_members" on public.household_members
  for select to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "owners can add members" on public.household_members;
create policy "owners can add members" on public.household_members
  for insert to authenticated
  with check (public.is_household_owner(household_id));

drop policy if exists "owners can update members" on public.household_members;
create policy "owners can update members" on public.household_members
  for update to authenticated
  using (public.is_household_owner(household_id));

drop policy if exists "owners can delete members" on public.household_members;
create policy "owners can delete members" on public.household_members
  for delete to authenticated
  using (public.is_household_owner(household_id));

-- Second cycle: household_members."hm_manage_owner" reads households, whose
-- member-read policies read household_members. Route those through the helper.
drop policy if exists "households read by member" on public.households;
create policy "households read by member" on public.households
  for select to authenticated
  using (public.is_household_member(id));

drop policy if exists "households_read_for_members" on public.households;
create policy "households_read_for_members" on public.households
  for select
  using (public.is_household_member(id));
