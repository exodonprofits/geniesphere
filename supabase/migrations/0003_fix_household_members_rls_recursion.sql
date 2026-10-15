-- Fix: "infinite recursion detected in policy for relation household_members" (42P17).
-- Applied to production 2026-10-15 as two migrations:
--   household_helpers_security_definer
--   household_rls_policies_use_definer_helpers
--
-- Four policies on public.household_members queried household_members itself,
-- and household_members."hm_manage_owner" -> households -> household_members
-- formed a second cycle. Any authenticated read of household_members errored,
-- and so did every table whose policy reads it (households, household_bills,
-- _documents, _events, _gifts, _tasks, _vehicles, vehicle_service_history).
--
-- The existing helpers already express the right checks; SECURITY DEFINER lets
-- policies call them without re-entering RLS. They only answer "is auth.uid() a
-- member/owner of this household". search_path is pinned. anon keeps execute
-- because households_read_for_members applies to anon (auth.uid() is null, so
-- the helpers return false).
--
-- ALTER (not DROP/CREATE) keeps policy names, roles and commands unchanged.
--
-- Verified after applying (as real users, read-only):
--   member: household_members 2, households 2, household_tasks 1, bills 1
--   signed-in non-member: all 0, no error; anon: households 0, no error.

alter function public.is_household_member(uuid) security definer set search_path = public, pg_temp;
alter function public.is_household_owner(uuid) security definer set search_path = public, pg_temp;
revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.is_household_owner(uuid) from public;
grant execute on function public.is_household_member(uuid) to anon, authenticated;
grant execute on function public.is_household_owner(uuid) to anon, authenticated;

alter policy "members can read household_members" on public.household_members
  using (public.is_household_member(household_id));
alter policy "owners can add members" on public.household_members
  with check (public.is_household_owner(household_id));
alter policy "owners can update members" on public.household_members
  using (public.is_household_owner(household_id));
alter policy "owners can delete members" on public.household_members
  using (public.is_household_owner(household_id));
alter policy "households read by member" on public.households
  using (public.is_household_member(id));
alter policy "households_read_for_members" on public.households
  using (public.is_household_member(id));

-- Rollback (restores the previous, recursive definitions):
-- alter function public.is_household_member(uuid) security invoker reset search_path;
-- alter function public.is_household_owner(uuid) security invoker reset search_path;
-- grant execute on function public.is_household_member(uuid) to public;
-- grant execute on function public.is_household_owner(uuid) to public;
-- alter policy "members can read household_members" on public.household_members using (exists (select 1 from public.household_members me where me.household_id = household_members.household_id and me.user_id = auth.uid()));
-- alter policy "owners can add members" on public.household_members with check (exists (select 1 from public.household_members me where me.household_id = household_members.household_id and me.user_id = auth.uid() and me.role = 'owner'));
-- alter policy "owners can update members" on public.household_members using (exists (select 1 from public.household_members me where me.household_id = household_members.household_id and me.user_id = auth.uid() and me.role = 'owner'));
-- alter policy "owners can delete members" on public.household_members using (exists (select 1 from public.household_members me where me.household_id = household_members.household_id and me.user_id = auth.uid() and me.role = 'owner'));
-- alter policy "households read by member" on public.households using (exists (select 1 from public.household_members hm where hm.household_id = households.id and hm.user_id = auth.uid()));
-- alter policy "households_read_for_members" on public.households using (exists (select 1 from public.household_members hm where hm.household_id = households.id and hm.user_id = auth.uid()));
