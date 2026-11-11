# Active Pages Registry

This file is the source of truth for production/canonical pages during the 0.1 refactor.

## Core

| Capability | Canonical path | Status |
|---|---|---|
| App entry | `/index.html` | live marketing homepage. Log in → `/core/auth/login.html`; Household card → `/core/dashboard/index.html`; "Sign in" hero buttons → `/core/auth/login.html` (invitation-only, ADR-015; no sign-up link); demo → `/dashboard/overview.html?mode=demo`. Business, Investment, Leisure and Finance cards are not linked ("Coming later"). `/about.html` exists only on the server |
| Login | `/core/auth/login.html` | slice 1: email/password via `gs-auth` against the GenieSphere project (ADR-015); `?next=` kept only if it resolves to this origin; invitation-only, no sign-up link; "Forgot password?" → `/core/auth/forgot.html`. No app shell |
| Forgot password | `/core/auth/forgot.html` | emails a reset link via Edge Function `gs-password-reset` (same answer whether or not the email has an account; 1 email per 5 min); no app shell |
| New password | `/core/auth/reset.html` | opened from the reset email (signed in by the link); sets a password of ≥10 characters, then dashboard; old links to `/reset_password.html` redirect here (`.htaccess`); no app shell |
| Dashboard | `/core/dashboard/index.html` | session required; household name + switcher; briefing; first 5 open tasks (due state by calendar day) with "See all" → Tasks; Home upkeep row and card from `home_maintenance_items`; app shell |
| Settings | `/core/settings/index.html` | household members (name, email, role); owner: invite by one-time link, pending invitations with revoke; session required; app shell |
| Join household | `/core/auth/invite.html#t=…` | opened from an invitation link; new account (password ≥10) or sign-in if the email already has one; no app shell |
| Tasks | `/core/tasks/index.html` | add (title, due date, who), assign, complete/undo, delete own tasks; grouped Overdue / This week / Later / No date; module tasks show their source ("Home Genie") and can't be deleted here; done in the last 14 days; session required; app shell |
| Genie | `/core/genie/index.html` | household assistant, phase 1 "brain, not hands" (ADR-022): "This week" briefing from open tasks (no AI); Ask Genie chat via `genie.chat` (shared `genie-chat.js`, same conversation as the floating sheet); proposal cards (new task, assign, grocery items) save only on Approve, with Undo for tasks; text/email drafts are copied or opened in Messages/Mail, never sent; "What Genie can do / Never" panel; session required; app shell (top-nav item 2; on phones reached from the floating button) |
| Notifications | `/core/notifications/index.html` | inbox (assigned to you, weekly summary; mark read / all read); email toggles per member and household (weekly summary, assigned to you); "Send me this week’s summary" (1 per 10 min); session required; app shell. Unread count on the avatar and in the account menu (`gs-shell.js`) |

| App shell (component) | `/shared/components/gs-shell.js` | top bar, account menu, phone bottom bar (5 tabs, no Genie tab); floating Genie button on every shell page except Genie, which loads Genie's scripts on first tap (ADR-023); mounts on `<body data-gs-shell="key">`; styles in `/shared/css/app.css` |
| Genie chat (component) | `/core/genie/genie-chat.js` | `GenieSphere.genieChat.mount/openSheet/closeSheet`; one conversation UI for the Genie page and the floating sheet; history in `sessionStorage` for the browser tab; fires `gs:data-changed` (`tasks`/`grocery`) after Approve/Undo, and Dashboard, Tasks, Grocery and Genie refresh |
| AI gateway (service) | `/core/ai/ai-gateway.js` → Edge Function `gs-ai-gateway` | `GenieSphere.ai.request({task, householdId, input})`; tasks: `meal_plan.generate` (10/household/day), `genie.chat` (30/household/day), `nutrition.photo_estimate` (20/household/day, photo never stored) |
| Meal photo (module component) | `/modules/nutrition/meal-photo.js` | `GenieSphere.mealPhoto.mount/shrink/estimate`; "Snap a meal" card on the Nutrition page: full-screen plate scanner (live camera, guide frame, crop to the frame) or a photo file → JPEG ≤768 px → `nutrition.photo_estimate`; calorie ranges, macros, household allergen flags, per-item portion scaling; nothing stored (ADR-025) |
| Grocery interface (module API) | `/modules/grocery/grocery-api.js` | `GenieSphere.grocery.activeListId`, `addItems` (skips items already on the list) |
| Household context (service) | `/core/household/household.js` | current household from `user_household_context`, else first membership by name; `members(householdId)` |
| Notifications (service) | `/core/notifications/notifications.js` → Edge Function `gs-notify` | `GenieSphere.notifications.list/unreadCount/markRead/markAllRead/prefs/savePrefs/sendTestDigest`; tables `household_notifications` (read + `read_at` only), `notification_prefs` (0010). `gs-notify` also runs from pg_cron every 5 min: assigned-to-you emails, Sunday 5 PM summary |
| Genie (service) | `/core/genie/genie.js` | `GenieSphere.genie.briefing/ask/apply/ACTIONS/memberName`; `apply` uses `GS.tasks` and `GS.grocery` with the signed-in person's permissions |
| Tasks (service) | `/core/tasks/tasks.js` | `GenieSphere.tasks.listOpen/listDone/add/complete/reopen/assign/remove/bucket` on `household_tasks` (`source_module`, `source_ref`, 0009) |
| Home interface (module API) | `/modules/home/home-api.js` | `GenieSphere.home.catalogFor/listAssets/addAsset/removeAsset/list/add/update/markDone/remove/status`; tables `household_assets`, `home_maintenance_items` (0009, 0011) |
| Account (service) | `/core/auth/account.js` → Edge Function `gs-password-reset` | `GenieSphere.account.requestPasswordReset/setNewPassword` |
| Email (Edge Function module) | `supabase/functions/_shared/email.ts` | invitation, reset, assigned-to-you and weekly-summary templates; Resend (`RESEND_API_KEY`, `FROM_EMAIL`), Bluehost SMTP as fallback |
| Invitations (service) | `/core/household/invites.js` → Edge Function `gs-household-invite` | `GenieSphere.invites.create/revoke/preview/accept`; tables `household_invites`, `household_members.display_name/email` (0008) |

## Modules

| Module | Canonical path | Status |
|---|---|---|
| Nutrition | `/modules/nutrition/index.html` | 0.1: household preferences (`household_nutrition_prefs`), 7-day plan via `gs-ai-gateway` saved per household and week (`household_meal_plans`); This week / Next week switch, opening on next week from Friday, allergen flags, adds groceries through `modules/grocery/grocery-api.js`; "Snap a meal" photo calorie estimate (ADR-025); app shell |
| Grocery | `/modules/grocery/index.html` | slice 1: shared household list (`shopping_lists` / `shopping_items`); app shell |
| Home | `/modules/home/index.html` | 0.1: homes the family lives in and its vehicles (`household_assets`, 0011), vehicles personal or business with an optional owner; filter by use; per asset a checklist (homes: 12 common jobs; vehicles: service and renewals: registration, insurance, emissions by expiry month), schedule with Done today / Renewed, frequency, remove, add your own; due items become household tasks named "Item · Asset" a week ahead (renewals 30–45 days) (0009, 0011, ADR-018, ADR-020, ADR-021); app shell |

## Cache busting

Canonical pages load `app.css` and every local script (`/core`, `/modules`, `/shared/js`, `/shared/components`) with one `?v=YYYYMMDDx` tag (currently `20261111c`). Change it on all pages whenever a CSS or JS file changes: browsers that cached a file before `.htaccess` sent `no-cache` keep using the old copy otherwise (seen live: `GS.household.members is not a function`).

## Legacy migration rule

When a page from the existing GenieSphere ZIP is selected as canonical:

1. Copy/refactor it into the correct active path.
2. Verify dependencies.
3. Update this file.
4. Move obsolete versions into `/archive/legacy-geniesphere/`.
5. Do not retain multiple files named `final`, `fixed`, `updated`, `v2`, etc. in active directories.
