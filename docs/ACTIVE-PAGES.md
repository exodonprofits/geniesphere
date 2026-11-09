# Active Pages Registry

This file is the source of truth for production/canonical pages during the 0.1 refactor.

## Core

| Capability | Canonical path | Status |
|---|---|---|
| App entry | `/index.html` | live marketing homepage. Log in → `/core/auth/login.html`; Household card → `/core/dashboard/index.html`; "Sign in" hero buttons → `/core/auth/login.html` (invitation-only, ADR-015; no sign-up link); demo → `/dashboard/overview.html?mode=demo`. Business, Investment, Leisure and Finance cards are not linked ("Coming later"). `/about.html` exists only on the server |
| Login | `/core/auth/login.html` | slice 1: email/password via `gs-auth` against the GenieSphere project (ADR-015); `?next=` kept only if it resolves to this origin; invitation-only, no sign-up link; "Forgot password?" → `/core/auth/forgot.html`. No app shell |
| Forgot password | `/core/auth/forgot.html` | emails a reset link via Edge Function `gs-password-reset` (same answer whether or not the email has an account; 1 email per 5 min); no app shell |
| New password | `/core/auth/reset.html` | opened from the reset email (signed in by the link); sets a password of ≥10 characters, then dashboard; no app shell |
| Dashboard | `/core/dashboard/index.html` | session required; household name + switcher; briefing; first 5 open tasks (due state by calendar day) with "See all" → Tasks; Home upkeep row and card from `home_maintenance_items`; app shell |
| Settings | `/core/settings/index.html` | household members (name, email, role); owner: invite by one-time link, pending invitations with revoke; session required; app shell |
| Join household | `/core/auth/invite.html#t=…` | opened from an invitation link; new account (password ≥10) or sign-in if the email already has one; no app shell |
| Tasks | `/core/tasks/index.html` | add (title, due date, who), assign, complete/undo, delete own tasks; grouped Overdue / This week / Later / No date; module tasks show their source ("Home Genie") and can't be deleted here; done in the last 14 days; session required; app shell |
| Notifications | `/core/notifications/index.html` | inbox (assigned to you, weekly summary; mark read / all read); email toggles per member and household (weekly summary, assigned to you); "Send me this week’s summary" (1 per 10 min); session required; app shell. Unread count on the avatar and in the account menu (`gs-shell.js`) |

| App shell (component) | `/shared/components/gs-shell.js` | top bar, account menu, phone bottom bar; mounts on `<body data-gs-shell="key">`; styles in `/shared/css/app.css` |
| AI gateway (service) | `/core/ai/ai-gateway.js` → Edge Function `gs-ai-gateway` | `GenieSphere.ai.request({task, householdId, input})`; tasks: `meal_plan.generate` (10/household/day) |
| Grocery interface (module API) | `/modules/grocery/grocery-api.js` | `GenieSphere.grocery.activeListId`, `addItems` (skips items already on the list) |
| Household context (service) | `/core/household/household.js` | current household from `user_household_context`, else first membership by name; `members(householdId)` |
| Notifications (service) | `/core/notifications/notifications.js` → Edge Function `gs-notify` | `GenieSphere.notifications.list/unreadCount/markRead/markAllRead/prefs/savePrefs/sendTestDigest`; tables `household_notifications` (read + `read_at` only), `notification_prefs` (0010). `gs-notify` also runs from pg_cron every 5 min: assigned-to-you emails, Sunday 5 PM summary |
| Tasks (service) | `/core/tasks/tasks.js` | `GenieSphere.tasks.listOpen/listDone/add/complete/reopen/assign/remove/bucket` on `household_tasks` (`source_module`, `source_ref`, 0009) |
| Home interface (module API) | `/modules/home/home-api.js` | `GenieSphere.home.catalogFor/listAssets/addAsset/removeAsset/list/add/update/markDone/remove/status`; tables `household_assets`, `home_maintenance_items` (0009, 0011) |
| Account (service) | `/core/auth/account.js` → Edge Function `gs-password-reset` | `GenieSphere.account.requestPasswordReset/setNewPassword` |
| Email (Edge Function module) | `supabase/functions/_shared/email.ts` | invitation, reset, assigned-to-you and weekly-summary templates; Resend (`RESEND_API_KEY`, `FROM_EMAIL`), Bluehost SMTP as fallback |
| Invitations (service) | `/core/household/invites.js` → Edge Function `gs-household-invite` | `GenieSphere.invites.create/revoke/preview/accept`; tables `household_invites`, `household_members.display_name/email` (0008) |

## Modules

| Module | Canonical path | Status |
|---|---|---|
| Nutrition | `/modules/nutrition/index.html` | 0.1: household preferences (`household_nutrition_prefs`), 7-day plan via `gs-ai-gateway` saved per household and week (`household_meal_plans`); This week / Next week switch, opening on next week from Friday, allergen flags, adds groceries through `modules/grocery/grocery-api.js`; app shell |
| Grocery | `/modules/grocery/index.html` | slice 1: shared household list (`shopping_lists` / `shopping_items`); app shell |
| Home | `/modules/home/index.html` | 0.1: homes and vehicles (`household_assets`, 0011), each personal / business / rental with an optional owner; filter by use; per asset a checklist (homes: 12 common jobs, rentals +2; vehicles: service and renewals: registration, insurance, emissions by expiry month), schedule with Done today / Renewed, frequency, remove, add your own; due items become household tasks named "Item · Asset" a week ahead (renewals 30–45 days) (0009, 0011, ADR-018, ADR-020); app shell |

## Cache busting

Canonical pages load `app.css` and every local script (`/core`, `/modules`, `/shared/js`, `/shared/components`) with one `?v=YYYYMMDDx` tag (currently `20261109h`). Change it on all pages whenever a CSS or JS file changes: browsers that cached a file before `.htaccess` sent `no-cache` keep using the old copy otherwise (seen live: `GS.household.members is not a function`).

## Legacy migration rule

When a page from the existing GenieSphere ZIP is selected as canonical:

1. Copy/refactor it into the correct active path.
2. Verify dependencies.
3. Update this file.
4. Move obsolete versions into `/archive/legacy-geniesphere/`.
5. Do not retain multiple files named `final`, `fixed`, `updated`, `v2`, etc. in active directories.
