-- Household invitations by one-time link, and member names/emails for the
-- Settings member list. Applied 2026-11-08 via the SQL editor after a dry run:
--   owner_email=<owner> owner_invites=1 owner_token_hash=blocked(42501)
--   owner_insert/update/lookup=blocked(42501) new_household_owner_email=<owner>
--   | stranger_invites=0 | anon_invites=blocked(42501) | lookup=owner lookup_unknown=NULL
--
-- Target: GenieSphere project (nxgtefbqizvihwikqnaw, ADR-015).
--
-- Flow (docs/DECISIONS.md ADR-016): the owner creates an invite through the
-- gs-household-invite Edge Function, which stores only the SHA-256 of a random
-- 256-bit token and returns the token once; the owner sends the link
-- themselves. Opening the link, the invitee sets a password (or signs in if the
-- email already has an account) and the function adds the membership. Every
-- write goes through the function (service role); browsers can only read.

begin;

-- 1. Members: name and email, shown to the household in Settings.
alter table public.household_members
  add column if not exists display_name text check (display_name is null or length(btrim(display_name)) between 1 and 80),
  add column if not exists email text check (email is null or length(email) <= 254);

update public.household_members m
   set email = lower(u.email)
  from auth.users u
 where u.id = m.user_id and m.email is null;

-- New households: record the owner's email with the owner membership.
create or replace function public.households_add_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.household_members (household_id, user_id, role, email)
  values (new.id, new.owner_id, 'owner', (select lower(email) from auth.users where id = new.owner_id))
  on conflict (household_id, user_id) do nothing;
  return new;
end $$;

-- 2. Invitations.
create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null check (email = lower(email) and length(email) between 3 and 254),
  display_name text check (display_name is null or length(btrim(display_name)) between 1 and 80),
  role text not null default 'member' check (role = 'member'),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz
);
create index if not exists household_invites_household_idx on public.household_invites (household_id, created_at desc);

alter table public.household_invites enable row level security;

create policy "household_invites owner read" on public.household_invites
  for select to authenticated
  using (public.is_household_owner(household_id));

-- Browsers may read every column except token_hash, and write nothing.
revoke all on public.household_invites from anon, authenticated;
grant select (id, household_id, email, display_name, role, created_by, created_at, expires_at, accepted_at, accepted_by, revoked_at)
  on public.household_invites to authenticated;

-- 3. Lookup used by the Edge Function: does this email already have an
-- account? auth.users is not exposed through the API. Service role only.
create or replace function public.gs_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1
$$;

revoke all on function public.gs_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.gs_user_id_by_email(text) to service_role;

commit;
