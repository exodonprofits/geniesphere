# GenieSphere 0.1 Architecture

## Goal

Create one small private-first Core that supports optional Genies without coupling them together.

```text
                    GenieSphere Core
        ┌──────────────┼──────────────┐
        │              │              │
  Nutrition Genie  Grocery Genie   Home Genie
```

## Core responsibilities

- Identity/authentication
- Household and household-member context
- Role and permission checks
- Shared dashboard shell
- Shared tasks
- Shared notifications
- Shared settings
- Shared file metadata/access
- AI routing
- Module registry

## Module responsibilities

Each module owns its domain tables, UI, rules, and workflows.

### Nutrition

- dietary preferences
- recipes
- meal plans
- meal history
- ingredient requirements

### Grocery

- shopping lists
- shopping items
- pantry inventory
- preferred stores
- shopping location
- store assignment/optimization

### Home

- home/property profile
- maintenance
- warranties
- household inventory
- service records

## Communication rule

Modules communicate through Core services or explicit integration events. They should not directly manipulate each other's internal tables.

Example:

Nutrition emits ingredient requirements -> Grocery consumes normalized requirements.

## Privacy model

Every record should have an ownership scope where appropriate:

- user
- household
- organization (future)
- module

Do not assume all household members can see all user-private data.

## AI model

```text
Module/UI
   ↓
GenieSphere AI Gateway
   ↓
Server-side provider adapter
   ↓
OpenAI / Anthropic / future provider
```

The AI provider is replaceable. GenieSphere owns the data model and workflow.

## Integration model

Salon Genie, Rental Genie, Arowana, and AskGenie247 remain independent products/apps initially.

Future integration should be through explicit adapters that expose only the minimum information needed by GenieSphere.
