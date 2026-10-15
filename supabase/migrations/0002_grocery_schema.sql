-- SUPERSEDED (2026-10-15 audit): do not apply as written. None of these tables
-- exist in production; the household-scoped Grocery schema will be rewritten
-- with RLS on top of the existing households model after 0003 is applied.
-- See docs/SLICE-1-GROCERY-PLAN.md.

-- Grocery Genie starter entities. Reconcile with existing tables before use.

create table if not exists public.store_preferences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  store_name text not null,
  store_place_id text,
  address text,
  preferred boolean not null default true,
  bulk_preferred boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item_name text not null,
  normalized_name text,
  quantity numeric,
  unit text,
  expires_on date,
  updated_at timestamptz not null default now()
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  strategy text not null default 'best_value' check (strategy in ('best_value','lowest_price','fewest_stores','closest_stores')),
  shopping_location jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references public.shopping_lists(id) on delete cascade,
  item_name text not null,
  quantity numeric,
  unit text,
  category text,
  assigned_store_preference_id uuid references public.store_preferences(id) on delete set null,
  checked boolean not null default false,
  created_at timestamptz not null default now()
);
