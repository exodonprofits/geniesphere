# Claude Code Instructions — GenieSphere 0.1

## Mission

Refactor the existing GenieSphere into a small, reliable private/family platform.

**Primary principle: Build the Skeleton, Not the Empire.**

Do not expand scope merely because legacy code contains additional features.

## Working rules

1. Never make a repo-wide rewrite unless explicitly requested.
2. Inspect first, propose second, change third.
3. Prefer the smallest safe diff.
4. Never modify archived files unless explicitly asked.
5. Never create a second Supabase client initializer.
6. Never hardcode passwords, service-role keys, secrets, or private API keys in browser code.
7. Do not duplicate shared navigation, auth guards, notifications, or task logic inside modules.
8. New module code must use Core services rather than reimplement them.
9. Preserve working business logic when refactoring UI or structure.
10. Before deleting a legacy file, confirm it is no longer referenced.
11. Update `docs/ACTIVE-PAGES.md` when a canonical page changes.
12. Record significant architecture choices in `docs/DECISIONS.md`.

## Core boundary

`core/` may contain only capabilities required by multiple modules:

- authentication
- household/member context
- permissions
- dashboard shell
- tasks
- notifications
- files metadata/access layer
- settings
- AI gateway

Module-specific business logic does not belong in Core.

## Target customer

GenieSphere is built for upper-middle-class and wealthy households. The
qualifier is complexity, not income: several properties, businesses,
vehicles, vendors/staff or advisers. Strongest segment: busy owners of
multiple businesses and properties (research `docs/RESEARCH-VALIDATION-GENIESPHERE-PRIVATE-001-RESULT.md`, segment B).

What this means for every change:

- Quality bar is premium: polished, fast, no console errors, phone-first.
- Privacy and security are part of the product, not a later phase. No feature
  may store what the research's "never store" list forbids (bank logins, full
  SSN/card numbers, seed phrases, alarm codes, medical records, biometrics).
- Design for delegation: owner, spouse/adult, assistant/house manager, adviser.
- Do not build: human concierge, bank/brokerage aggregation, investment or
  legal advice, bill pay. The premium "Private" offer stays VALIDATE FIRST.

## Current approved modules

- Nutrition
- Grocery
- Home

Do not add Travel, Vehicle, Finance, Salon, Rental, Arowana, or other modules to active development unless explicitly requested.

## Supabase rule

All browser pages must get Supabase through the canonical shared client:

`shared/js/app-config.js` -> `shared/js/gs-client.js` -> `shared/js/gs-auth.js`

No page may call `createClient()` directly.

## AI rule

All AI calls must pass through `core/ai/ai-gateway.js` or a server-side function invoked by it. Modules must not embed provider-specific API keys or directly call OpenAI/Anthropic from browser code.

## Git workflow

Recommended branches:

- `main` — stable
- `develop` — integration
- `refactor/core-auth`
- `refactor/navigation`
- `feature/grocery-location`

Commit messages should be concise and scoped, e.g.:

- `refactor(auth): use canonical supabase client`
- `feat(grocery): add store preference model`
- `docs: update active pages registry`

## Definition of done

A change is done only when:

- existing working behavior is preserved unless intentionally changed
- no duplicate service was introduced
- console errors are resolved for touched pages
- relevant docs are updated
- secrets are not exposed
- changed pages can load through the canonical app shell
