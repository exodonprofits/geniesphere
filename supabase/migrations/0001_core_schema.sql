-- SUPERSEDED (2026-10-15 audit): do not apply. Production already has
-- public.households (owner_id, not created_by), public.household_members
-- (no id column; composite household_id+user_id), public.household_tasks and
-- public.household_notifications, all with RLS. Core 0.1 builds on those.
-- See docs/SLICE-1-GROCERY-PLAN.md.

-- GenieSphere 0.1 starter schema.
-- Review against the existing production database before applying.

create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'member' check (role in ('owner','adult','member','child','guest')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table if not exists public.module_installations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  module_key text not null,
  enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (household_id, module_key)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  source_module text,
  title text not null,
  notes text,
  status text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  source_module text,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS should be enabled and policies written only after reconciling the
-- existing production membership/auth model. Do not deploy permissive
-- placeholder policies to production.
