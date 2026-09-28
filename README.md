# GenieSphere 0.1

**Build the Skeleton, Not the Empire.**

GenieSphere 0.1 is a private-first, modular AI operating system for personal and family use. The first goal is to create a small, dependable Core and three useful household modules: Nutrition, Grocery, and Home.

## Product priorities

1. One canonical authentication flow.
2. One shared dashboard.
3. One shared task and notification system.
4. One shared AI gateway.
5. Three initial modules only: Nutrition, Grocery, Home.
6. Archive legacy experiments instead of deleting them.
7. Integrate Salon Genie, Rental Genie, and Arowana later through adapters/APIs rather than merging their codebases.

## Repository map

```text
geniesphere/
├── core/                 # Shared platform capabilities only
├── modules/              # Optional Genie modules
├── shared/               # Shared UI, JS helpers, assets
├── integrations/         # Future adapters to external Genie apps
├── supabase/             # Database migrations and Edge Functions
├── docs/                 # Architecture and migration decisions
├── tests/                # Smoke/integration tests
└── archive/              # Legacy code moved out of active paths
```

## Initial modules

- `modules/nutrition` — meal planning and meal history
- `modules/grocery` — grocery generation, pantry subtraction, location/store optimization
- `modules/home` — maintenance, inventory, warranties, reminders

## Development rule

A feature belongs in `core/` only if multiple Genies need it. Otherwise it belongs inside its module.

## Start here

Read these files before changing code:

1. `CLAUDE.md`
2. `docs/ARCHITECTURE.md`
3. `docs/ACTIVE-PAGES.md`
4. `docs/MIGRATION-PLAN.md`
5. `docs/DECISIONS.md`

## First milestone

Produce a private household alpha that can:

- sign in securely
- identify a household and its members
- show a useful home dashboard
- show shared tasks and notifications
- launch Nutrition, Grocery, and Home Genies
- route AI requests through one gateway
- keep module data permission-aware

Commercial SaaS work is intentionally out of scope for 0.1.
