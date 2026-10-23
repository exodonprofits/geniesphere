# Active Pages Registry

This file is the source of truth for production/canonical pages during the 0.1 refactor.

## Core

| Capability | Canonical path | Status |
|---|---|---|
| App entry | `/index.html` | live marketing homepage. Log in → `/core/auth/login.html`; Household card → `/core/dashboard/index.html`; Create an account → `/onboarding/signup.html`; demo → `/dashboard/overview.html?mode=demo`. Business, Investment, Leisure and Finance cards are not linked ("Coming later"). `/about.html` exists only on the server |
| Login | `/core/auth/login.html` | slice 1: email/password via `gs-auth`; `?next=` kept only if it resolves to this origin. No app shell |
| Dashboard | `/core/dashboard/index.html` | slice 1: session required; household name + switcher; open `household_tasks`; app shell |
| Settings | `/core/settings/index.html` | placeholder; session required; app shell |
| Tasks | `/core/tasks/index.html` | placeholder; session required; app shell |
| Notifications | `/core/notifications/index.html` | placeholder; session required; app shell |

| App shell (component) | `/shared/components/gs-shell.js` | top bar, account menu, phone bottom bar; mounts on `<body data-gs-shell="key">`; styles in `/shared/css/app.css` |
| Household context (service) | `/core/household/household.js` | slice 1: current household from `user_household_context`, else first membership by name |

## Modules

| Module | Canonical path | Status |
|---|---|---|
| Nutrition | `/modules/nutrition/index.html` | placeholder; session required; app shell |
| Grocery | `/modules/grocery/index.html` | slice 1: shared household list (`shopping_lists` / `shopping_items`); app shell |
| Home | `/modules/home/index.html` | placeholder; session required; app shell |

## Legacy migration rule

When a page from the existing GenieSphere ZIP is selected as canonical:

1. Copy/refactor it into the correct active path.
2. Verify dependencies.
3. Update this file.
4. Move obsolete versions into `/archive/legacy-geniesphere/`.
5. Do not retain multiple files named `final`, `fixed`, `updated`, `v2`, etc. in active directories.
