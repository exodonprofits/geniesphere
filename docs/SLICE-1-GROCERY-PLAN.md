# Slice 1: Login → Core dashboard → Grocery

Audit date: 2026-10-15. Goal: one end-to-end 0.1 path on the canonical client
(`app-config.js` → `gs-client.js` → `gs-auth.js`), household-scoped.

## Current state

| Area | State |
| --- | --- |
| `core/auth/login.html`, `core/dashboard/index.html`, `modules/grocery/index.html` | static starter stubs, no Supabase |
| `shared/js/gs-client.js`, `gs-auth.js` | canonical client + session helpers exist |
| `supabase/migrations/0001`, `0002` | starter drafts that conflict with production; marked superseded |
| `public.households` (2 rows), `household_members` (2) | exist, RLS on |
| `public.household_tasks` (1), `household_notifications` (0), `user_household_context` | exist, RLS on |
| `public.grocery_items` (0 rows) | legacy, user-scoped (`user_id`), not household-scoped |
| `store_preferences`, `pantry_items`, `shopping_lists`, `shopping_items` | do not exist |

## Blocker found: RLS recursion (production bug)

As an authenticated user, reading `household_members` fails with
`42P17 infinite recursion detected in policy for relation "household_members"`.
Four policies on `household_members` query `household_members` itself, and
`hm_manage_owner` → `households` → `household_members` forms a second cycle.
Every table whose policy reads `household_members` fails the same way:
`households`, `household_bills`, `household_documents`, `household_events`,
`household_gifts`, `household_tasks`, `household_vehicles`,
`vehicle_service_history`.

Fix: `supabase/migrations/0003_fix_household_members_rls_recursion.sql`
(not yet applied). Makes `is_household_member` / `is_household_owner`
`SECURITY DEFINER` with a pinned `search_path` (same logic) and points the six
cycling policies at them. Same access rules, no recursion.

## Plan

1. Apply 0003 (needs approval; production change). Verify as a real user that
   `household_members`, `households`, `household_tasks` read without error.
2. Core household context (`core/household/`): resolve the current household
   from `user_household_context`, falling back to the user's first membership.
3. `core/auth/login.html`: real email/password + magic link via `gs-auth.js`.
4. `core/dashboard/index.html`: require session, show household name, open
   `household_tasks`, module cards.
5. Grocery schema (0004): `shopping_lists`, `shopping_items` (household-scoped,
   RLS via `is_household_member`). Pantry and store preferences follow in a
   later slice. Legacy `grocery_items` is left untouched.
6. `modules/grocery/index.html`: one list per household, add / check off /
   remove items.
7. Update `docs/ACTIVE-PAGES.md`; deploy via dry run → upload.

## Progress (2026-10-15)

| Step | State |
| --- | --- |
| 1. RLS recursion fix (0003) | applied and verified as member, non-member and anon |
| 2. Core household context | `core/household/household.js` |
| 3. Core login | `core/auth/login.html` |
| 4. Core dashboard | `core/dashboard/index.html` |
| 5. Grocery schema (0004) | applied; member CRUD works, outsider insert blocked (42501), outsider sees/updates 0 rows |
| 6. Grocery page | `modules/grocery/index.html` |
| 7. Registry / deploy | registry updated; deploy pending a dry run |

Browser test: `tests/e2e/slice1.test.js` (all steps pass against an
in-memory Supabase stand-in). Real sign-in still needs a manual check on the
live site after deploy.

Supabase connector note: `DROP POLICY` and unscoped `UPDATE` hang in the
connector (likely a confirmation prompt it cannot show). Use `ALTER POLICY`
and scoped statements.
