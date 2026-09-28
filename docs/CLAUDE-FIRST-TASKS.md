# First Claude Code Tasks

Use these in order. Do not give Claude Code a single prompt to "clean the whole repo."

## Task 1 — Read-only architecture inventory

> Study the repository carefully. Do not modify any files. Identify every Supabase initialization path, auth guard, shared navigation/header implementation, and duplicate production page. Compare them with `CLAUDE.md` and `docs/ARCHITECTURE.md`. Return a migration map with file paths, dependencies, and risk level.

## Task 2 — Canonical Supabase client

> Using the approved migration map, refactor only Supabase initialization to use `shared/js/app-config.js`, `shared/js/gs-client.js`, and `shared/js/gs-auth.js`. Do not change UI or domain business logic. Preserve current session behavior. Update `docs/ACTIVE-PAGES.md` and `docs/DECISIONS.md` if needed.

## Task 3 — Canonical app shell

> Identify the best existing header/navigation implementation and adapt it into `shared/components/`. Replace navigation only on active Core pages. Do not touch archived or inactive module pages.

## Task 4 — Nutrition canonicalization

> Identify the strongest current Nutrition/meal-planner implementation. Propose which files should become canonical and which should move to archive. Do not change files until the proposal is approved.

## Task 5 — Grocery location feature

> After Grocery is canonical, design the smallest implementation for shopping location, store preferences, and a purchase list grouped by selected store. Keep store optimization separate from UI rendering and preserve current pantry subtraction.
