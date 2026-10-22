-- Household RLS cleanup (follows 0003, which fixed the recursion).
-- Not yet applied: waiting on the SQL-editor dry run.
--
-- Target: live "Exodon Profits" project. Independent of 0001/0002, which
-- must NOT be applied there (households/household_members already exist
-- with a different shape).
--
-- The 42P17 recursion is already fixed live: is_household_member() and
-- is_household_owner() are SECURITY DEFINER and the policies call them.
-- This migration only tidies what remains. Access is unchanged except where
-- noted.
--
--   households         drop 2 duplicate policies; owner_id kept in the read
--                      policy so insert(...).select() still returns the row
--                      before the owner-member trigger has run
--   household_members  drop hm_read_self (covered by the member read policy);
--                      UPDATE gets a WITH CHECK so a row can't be moved into a
--                      household the caller doesn't own
--   helpers            signed-out users can no longer call them (no policy
--                      for anon uses them after the drops above)

begin;

-- households -------------------------------------------------------------

-- Same check as "households read by member", but for role public.
drop policy if exists "households_read_for_members" on public.households;

-- ALL policy overlapping the per-command owner policies. Its only extra
-- effect was letting owner_id read the row, folded into the read policy.
drop policy if exists "households_write_owner_only" on public.households;

drop policy if exists "households read by member" on public.households;
create policy "households read by member" on public.households
  for select to authenticated
  using (owner_id = auth.uid() or public.is_household_member(id));

-- household_members ------------------------------------------------------

-- A user's own row is already visible through is_household_member().
drop policy if exists "hm_read_self" on public.household_members;

drop policy if exists "owners can update members" on public.household_members;
create policy "owners can update members" on public.household_members
  for update to authenticated
  using (public.is_household_owner(household_id))
  with check (public.is_household_owner(household_id));

-- hm_manage_owner (households.owner_id path) is kept: it is not a duplicate
-- of the role-based policies and covers an owner whose member row changed.

-- helpers ----------------------------------------------------------------

revoke execute on function public.is_household_member(uuid) from public, anon;
revoke execute on function public.is_household_owner(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated, service_role;
grant execute on function public.is_household_owner(uuid) to authenticated, service_role;

commit;
