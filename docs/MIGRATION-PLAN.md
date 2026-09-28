# Migration Plan — Existing GenieSphere -> GenieSphere 0.1

## Phase 0 — Inventory and freeze

- Put the current working GenieSphere ZIP in source control unchanged on a `legacy-import` branch or under a local backup.
- Do not immediately rewrite legacy pages.
- Identify every live URL currently in use.
- Identify all Supabase client initializers.
- Identify all auth guards.
- Identify all shared header/navigation implementations.

## Phase 1 — Canonical Core

1. Adopt one app config.
2. Adopt one Supabase client.
3. Adopt one auth/session helper.
4. Adopt one app shell/header/navigation.
5. Establish household/member context.
6. Establish tasks and notifications interfaces.
7. Establish module registry.
8. Establish AI gateway contract.

## Phase 2 — Move three modules only

### Nutrition

- Choose one current meal-planner implementation.
- Preserve meal plan persistence and ingredient generation.
- Remove duplicate versions from active paths.

### Grocery

- Preserve consolidated grocery list and pantry logic.
- Add selected shopping location.
- Add preferred/nearby stores.
- Add store assignment and shopping strategy.

### Home

- Keep only maintenance, reminders, inventory, warranties for 0.1.
- Archive the rest until needed.

## Phase 3 — Household alpha

Run the system in real family use for several weeks.

Track:

- pages actually opened
- tasks completed
- recurring friction
- duplicate data entry
- features never used
- AI usage/cost

## Phase 4 — Expand only from evidence

Do not activate additional modules until the first three prove useful.
