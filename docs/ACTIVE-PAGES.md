# Active Pages Registry

This file is the source of truth for production/canonical pages during the 0.1 refactor.

## Core

| Capability | Canonical path | Status |
|---|---|---|
| App entry | `/index.html` | live marketing homepage (pulled from Bluehost 2026-10-15; links to `/onboarding/login.html` and `/dashboard/*`; `/about.html` exists only on the server) |
| Login | `/core/auth/login.html` | starter |
| Dashboard | `/core/dashboard/index.html` | starter |
| Settings | `/core/settings/index.html` | starter |
| Tasks | `/core/tasks/index.html` | starter |
| Notifications | `/core/notifications/index.html` | starter |

## Modules

| Module | Canonical path | Status |
|---|---|---|
| Nutrition | `/modules/nutrition/index.html` | starter |
| Grocery | `/modules/grocery/index.html` | starter |
| Home | `/modules/home/index.html` | starter |

## Legacy migration rule

When a page from the existing GenieSphere ZIP is selected as canonical:

1. Copy/refactor it into the correct active path.
2. Verify dependencies.
3. Update this file.
4. Move obsolete versions into `/archive/legacy-geniesphere/`.
5. Do not retain multiple files named `final`, `fixed`, `updated`, `v2`, etc. in active directories.
