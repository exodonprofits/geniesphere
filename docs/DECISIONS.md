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

## ADR-007 — Bluehost FTPS trust: pinned IP + fixed certificate name

**Decision:** The Bluehost FTPS workflow connects to the account's server IP (`BLUEHOST_EXPECTED_IP`) and verifies the certificate chain against the fixed name `bluehost.com` (`BLUEHOST_CERT_NAME`) instead of the connection hostname.

**Reason:** The server presents Bluehost's shared `*.bluehost.com` certificate, while its only hostnames (`qyg.lxt.mybluehost.me`, `50-6-156-176.unifiedlayer.com`) are not covered by it, so strict hostname verification cannot pass. Disabling verification was rejected. The trade-off is that the certificate proves "a Bluehost server", and the IP pin proves "this account's server". Revisit if Bluehost changes the certificate or moves the account, or when moving deploys to SFTP with a pinned host key.

## ADR-008 — Bluehost deploys are manual, additive, and backed up

**Decision:** `bluehost-deploy.yml` runs only on manual dispatch from main, defaults to a dry run, never deletes server files that are not being replaced, skips unchanged files via a remote sha256 manifest, and archives any pre-existing server file before replacing it. n8n workflow exports are excluded from the package.

**Reason:** The live web root already contains files not managed by this repo, and the 0.1 refactor is in progress, so publishing should be a deliberate act with a reviewable plan and an undo path. A deleting sync could wipe unmanaged content. n8n exports expose webhook URLs and are not used by any page.
