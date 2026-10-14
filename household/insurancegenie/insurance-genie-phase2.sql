-- ============================================================
-- Insurance Genie (Phase 1) — Supabase schema + RLS
-- Tables:
--   insurance_intakes  : stores the submitted intake JSON
--   insurance_analyses : stores AI analysis JSON (optional, from n8n)
-- Notes:
--   - Requires pgcrypto for gen_random_uuid()
--   - Uses auth.uid() for RLS
-- ============================================================

create extension if not exists pgcrypto;

-- ----------------------------
-- insurance_intakes
-- ----------------------------
create table if not exists public.insurance_intakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'submitted' check (status in ('draft','submitted','archived')),
  intake jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists insurance_intakes_user_created_idx
  on public.insurance_intakes (user_id, created_at desc);

create index if not exists insurance_intakes_intake_gin_idx
  on public.insurance_intakes using gin (intake);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_insurance_intakes_updated_at on public.insurance_intakes;
create trigger trg_insurance_intakes_updated_at
before update on public.insurance_intakes
for each row execute function public.set_updated_at();

-- ----------------------------
-- insurance_analyses
-- ----------------------------
create table if not exists public.insurance_analyses (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.insurance_intakes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis jsonb not null,
  risk_score int null,
  coverage_gap_score int null,
  overpay_estimate numeric null,
  created_at timestamptz not null default now()
);

create index if not exists insurance_analyses_intake_created_idx
  on public.insurance_analyses (intake_id, created_at desc);

create index if not exists insurance_analyses_user_created_idx
  on public.insurance_analyses (user_id, created_at desc);

create index if not exists insurance_analyses_analysis_gin_idx
  on public.insurance_analyses using gin (analysis);

-- ============================================================
-- RLS
-- ============================================================
alter table public.insurance_intakes enable row level security;
alter table public.insurance_analyses enable row level security;

-- insurance_intakes policies
drop policy if exists "insurance_intakes_select_own" on public.insurance_intakes;
create policy "insurance_intakes_select_own"
on public.insurance_intakes
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "insurance_intakes_insert_own" on public.insurance_intakes;
create policy "insurance_intakes_insert_own"
on public.insurance_intakes
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "insurance_intakes_update_own" on public.insurance_intakes;
create policy "insurance_intakes_update_own"
on public.insurance_intakes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "insurance_intakes_delete_own" on public.insurance_intakes;
create policy "insurance_intakes_delete_own"
on public.insurance_intakes
for delete
to authenticated
using (user_id = auth.uid());

-- insurance_analyses policies
drop policy if exists "insurance_analyses_select_own" on public.insurance_analyses;
create policy "insurance_analyses_select_own"
on public.insurance_analyses
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "insurance_analyses_insert_own" on public.insurance_analyses;
create policy "insurance_analyses_insert_own"
on public.insurance_analyses
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.insurance_intakes i
    where i.id = intake_id and i.user_id = auth.uid()
  )
);

drop policy if exists "insurance_analyses_delete_own" on public.insurance_analyses;
create policy "insurance_analyses_delete_own"
on public.insurance_analyses
for delete
to authenticated
using (user_id = auth.uid());

-- Optional: keep analyses immutable (no updates)
revoke update on public.insurance_analyses from anon, authenticated;

-- ============================================================
-- Done
-- ============================================================
