# Architecture Decision Log

## ADR-001 — Private-first before SaaS

**Decision:** GenieSphere 0.1 is built for personal/household use first.

**Reason:** Prove real daily value before adding public onboarding, billing, tenant administration, or enterprise features.

## ADR-002 — Modular Genies

**Decision:** Genies are optional modules attached to a shared Core.

**Reason:** Future households can adopt different combinations without cloning the entire product.

## ADR-003 — Core stays small

**Decision:** A feature belongs in Core only when multiple modules require it.

## ADR-004 — One Supabase client

**Decision:** All browser pages must use the shared GenieSphere client initialization path.

## ADR-005 — AI providers are replaceable

**Decision:** All AI calls route through a GenieSphere gateway rather than embedding provider logic throughout modules.

## ADR-006 — Legacy code is archived, not deleted

**Decision:** Existing experiments remain recoverable while active code remains unambiguous.
