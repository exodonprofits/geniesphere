-- Block self-promotion through gs_user_preferences.role.
-- Not yet applied: waiting on the SQL-editor dry run.
--
-- Target: live "Exodon Profits" project (shared with Salon Genie, Arowana).
--
-- Problem: the "update own" / "insert own" policies on gs_user_preferences
-- (and the security_invoker view public.user_preferences over it) let a user
-- write every column of their own row, including role. role decides:
--   * is_admin(): "Admin read all", "Admin can update all preferences" and
--     "Admin can insert/delete preferences" on gs_user_preferences
--   * the create-auth-user Edge Function (owner/manager/admin may create
--     confirmed logins)
--   * client-side checks on the admin dashboards
--
-- Fix: same pattern as ap_protect_profile_columns on public.profiles. Only the
-- server (service_role / postgres) or an existing admin may set or change
-- role. Every other column stays user-editable.
--
-- Callers checked (2026-10-22):
--   * geniesphere and salongenie browser code: no page writes role except
--     onboarding/invite_user.html, which calls auth.admin.createUser from the
--     browser and so cannot work anyway
--   * no database function writes role; create-auth-user writes it with the
--     service role, which this trigger allows
--   * upserts that omit role keep the existing value (INSERT path: null)

begin;

create or replace function public.gs_user_preferences_guard_role()
returns trigger
language plpgsql
-- Not '': the admin check below reads gs_user_preferences under RLS, whose
-- admin policies call is_admin(), which refers to user_preferences unqualified.
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
     or current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if (tg_op = 'INSERT' and new.role is not null)
     or (tg_op = 'UPDATE' and new.role is distinct from old.role) then
    -- Runs as the caller, so RLS applies: a user can only see their own row,
    -- which is exactly the row this check needs.
    if not exists (
      select 1 from public.gs_user_preferences
      where user_id = auth.uid() and role = 'admin'
    ) then
      raise exception 'Roles can only be changed by an administrator'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists gs_user_preferences_guard_role on public.gs_user_preferences;
create trigger gs_user_preferences_guard_role
  before insert or update on public.gs_user_preferences
  for each row execute function public.gs_user_preferences_guard_role();

commit;
