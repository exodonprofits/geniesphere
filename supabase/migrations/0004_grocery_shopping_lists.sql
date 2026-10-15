-- Grocery Genie, slice 1: household shopping lists.
-- Household-scoped; access via public.is_household_member (SECURITY DEFINER,
-- see 0003). Any household member can read and edit the household's lists.
-- Pantry and store preferences come in a later slice. Legacy public.grocery_items
-- (user-scoped, unused) is left untouched.

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null default 'Shopping list' check (length(btrim(title)) between 1 and 120),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, household_id)
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null,
  household_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 200),
  quantity text check (quantity is null or length(quantity) <= 60),
  checked boolean not null default false,
  checked_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- An item always belongs to a list of the same household.
  foreign key (shopping_list_id, household_id)
    references public.shopping_lists (id, household_id) on delete cascade
);

create index if not exists shopping_lists_household_idx on public.shopping_lists (household_id) where archived_at is null;
create index if not exists shopping_items_list_idx on public.shopping_items (shopping_list_id, checked, created_at);

alter table public.shopping_lists enable row level security;
alter table public.shopping_items enable row level security;

create policy "shopping_lists member access" on public.shopping_lists
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "shopping_items member access" on public.shopping_items
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

revoke all on public.shopping_lists, public.shopping_items from anon;
grant select, insert, update, delete on public.shopping_lists, public.shopping_items to authenticated;
