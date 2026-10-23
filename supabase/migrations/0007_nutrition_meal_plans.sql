-- Nutrition Genie 0.1: household meal plans, saved preferences, and AI usage.
-- Not yet applied: waiting on the SQL-editor dry run.
--
-- Household-scoped like 0004: access via public.is_household_member
-- (SECURITY DEFINER). Any household member can read and edit the household's
-- plans and preferences.
--
-- Legacy public.weekly_meal_plans / nutrition_profiles / meal_history are
-- user-scoped, empty and unused; they are left untouched.
--
-- Privacy (CLAUDE.md "never store"): preferences hold meal goals such as
-- "diabetic-friendly", never medical conditions or diagnoses. The page does
-- not ask for them and the gateway does not accept them.

begin;

-- One saved preference set per household, reused for the next plan.
create table if not exists public.household_nutrition_prefs (
  household_id uuid primary key references public.households(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb check (octet_length(prefs::text) <= 8000),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- One plan per household per week; regenerating replaces it.
create table if not exists public.household_meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null,
  prefs jsonb not null default '{}'::jsonb check (octet_length(prefs::text) <= 8000),
  plan jsonb not null check (octet_length(plan::text) <= 200000),
  grocery jsonb not null default '[]'::jsonb check (jsonb_typeof(grocery) = 'array'),
  macro jsonb,
  model text check (model is null or length(model) <= 60),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, week_start)
);
create index if not exists household_meal_plans_recent_idx on public.household_meal_plans (household_id, week_start desc);

-- AI usage per household. Written only by the gs-ai-gateway Edge Function
-- (service role) through gs_ai_usage_reserve(); members may read their
-- household's rows to see how many generations are left today.
create table if not exists public.gs_ai_usage (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  task text not null check (task ~ '^[a-z0-9_.]{1,60}$'),
  tokens integer,
  created_at timestamptz not null default now()
);
create index if not exists gs_ai_usage_daily_idx on public.gs_ai_usage (household_id, task, created_at desc);

alter table public.household_nutrition_prefs enable row level security;
alter table public.household_meal_plans enable row level security;
alter table public.gs_ai_usage enable row level security;

create policy "household_nutrition_prefs member access" on public.household_nutrition_prefs
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "household_meal_plans member access" on public.household_meal_plans
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "gs_ai_usage member read" on public.gs_ai_usage
  for select to authenticated
  using (public.is_household_member(household_id));

revoke all on public.household_nutrition_prefs, public.household_meal_plans, public.gs_ai_usage from anon;
grant select, insert, update, delete on public.household_nutrition_prefs, public.household_meal_plans to authenticated;
grant select on public.gs_ai_usage to authenticated;

-- Counts today's (UTC) calls for this household + task and records one more,
-- atomically, before the AI call is made. Returns the new count, or -1 when the
-- daily limit is already reached. Callable by the service role only.
create or replace function public.gs_ai_usage_reserve(
  p_household uuid, p_user uuid, p_task text, p_limit integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
begin
  -- Serialise concurrent reservations for the same household and task.
  perform pg_advisory_xact_lock(hashtextextended(p_household::text || ':' || p_task, 0));
  select count(*) into used from public.gs_ai_usage
   where household_id = p_household and task = p_task
     and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if used >= p_limit then
    return -1;
  end if;
  insert into public.gs_ai_usage (household_id, user_id, task) values (p_household, p_user, p_task);
  return used + 1;
end;
$$;

revoke all on function public.gs_ai_usage_reserve(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.gs_ai_usage_reserve(uuid, uuid, text, integer) to service_role;

commit;
