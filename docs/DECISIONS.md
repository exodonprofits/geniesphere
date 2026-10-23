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

## ADR-009 — app-config.js serves both legacy GSConfig and the canonical client

**Decision:** `shared/js/app-config.js` keeps the live `window.GSConfig` loader (fetches `/shared/config.json`) and also sets `window.GenieSphereConfig` synchronously with the public Supabase URL and anon key, which `shared/js/gs-client.js` reads. `scripts/package_site.py` refuses to package if those values differ from `shared/config.json`.

**Reason:** The live site's pages (signup, credit card, nutrition and others) call `GSConfig`; the repo's placeholder `app-config.js` defined only an empty `GenieSphereConfig`, so deploying it would have broken both the legacy pages and the canonical client. The anon key is public by design (RLS protects data). Remove the `GSConfig` loader once no active page uses it.

**Addendum:** `shared/js/gs-client.js` likewise keeps the live `window.GSClient.getAsync()/getSync()` API (about 40 legacy pages and `auth-header.js` / `hub-badges.js` use it) on top of `window.GenieSphere.getSupabase()`. Both return one client, created synchronously with the live auth options (persistSession, autoRefreshToken, detectSessionInUrl). `shared/js/sb-client.js` is still a second legacy initializer, unchanged from live. No page loads it together with `gs-client.js`, so no page runs two clients. It is used by the live login flow (`onboarding/login.html`, `auth/auth-callback.html`) and a few legacy pages; it is deliberately left in place and retired when the 0.1 login (`/core/auth/login.html`) replaces `onboarding/login.html`, rather than rewiring the live login now.

## ADR-010 — Slice 1 builds on the existing household tables

**Decision:** Core 0.1 uses production's `households`, `household_members`, `household_tasks` and `user_household_context` rather than the starter `0001` schema. The current household is the user's saved choice in `user_household_context`, else their first membership by name. Grocery data lives in new household-scoped `shopping_lists` / `shopping_items` (RLS via `is_household_member`); any household member may read and edit them. Legacy `grocery_items` (user-scoped, empty) is left alone.

**Reason:** The starter schema conflicted with live tables that already hold data and RLS. Building on them avoids a migration of real households and keeps legacy pages working.

## ADR-011 — The web root .htaccess is managed in git

**Decision:** The repo root `.htaccess` is the only server configuration file `scripts/package_site.py` ships. It sets `DirectoryIndex index.html index.php` and keeps cPanel's PHP handler block; it drops the WordPress rewrite rules. The deploy workflow's backup and fetch artifacts include hidden files, so the replaced server `.htaccess` is kept for 90 days.

**Reason:** On 2026-10-15 Bluehost installed WordPress into the web root (`index.php` plus a WordPress/Newfold `.htaccess`). Apache then served WordPress at `/` instead of our `index.html`, and the additive deploy cannot delete `index.php`. Owning `.htaccess` restores the homepage without deleting server files. If Bluehost's htaccess manager rewrites the file, remove the WordPress install from the site rather than fighting it.

## ADR-012 — One app shell for Core and the 0.1 modules

**Decision:** `shared/components/gs-shell.js` builds the top bar (brand, nav, account menu) and the phone bottom bar with `createElement`, and mounts on any page whose `<body>` has `data-gs-shell="<active key>"`. The nav list lives only in that file: Dashboard, Grocery, Nutrition, Home, Tasks; Notifications and Settings are in the account menu. It reads the session through `GenieSphere.auth` and signs out through it; it does not guard pages, which still call `requireSession()`. It is used on the 7 Core and module pages, not on the login page or legacy pages. The design follows the legacy `dashboard/overview.html` topbar + mobile-nav, with the homepage's brand colours.

**Reason:** No shared nav existed; legacy pages copy one of several nav markups into each file (138 pages use one, 44 another). A single injected component keeps the 0.1 pages consistent and makes adding a module a one-line change. A module registry (`module_installations`) can replace the static list once modules can be turned off per household.

**Addendum (2026-10-23):** `shared/css/app.css` now carries the legacy app design system instead of the starter's neutral styles: Inter, the household hub's teal accent (`#22D3EE` / `#0891B2`), 18–24px radii with layered shadows, pill buttons and ok/warn/urgent/empty status pills, uppercase eyebrows and 900-weight titles. Components: page header, panel (`gs-panel*`), icon-tile rows (`gs-item-row`), status chips, stat cards, module tiles. The dashboard follows `dashboard/household.html` ("Today at Home" plus quick status), with every number from live household data and "Not set up" for modules that don't exist yet. Only the 0.1 pages load `app.css`, so legacy pages are unaffected.

## ADR-013 — Target customer: affluent, complexity-qualified households

**Decision:** GenieSphere targets upper-middle-class and wealthy households, qualified by operational complexity (properties, businesses, vehicles, vendors/staff, advisers) rather than income. The strongest segment is busy multi-business / multi-property owners. Consequences for 0.1: premium quality bar; privacy and security treated as product features; data isolation from the other Genies before any household outside the founder's is onboarded; roles designed for delegation (owner, adult, assistant/house manager, adviser); the dashboard's primary job is the "what needs my attention today" briefing. The "GenieSphere Private" premium offer remains VALIDATE FIRST and is not built ahead of discovery.

**Reason:** Owner direction (2026-10-23), consistent with `docs/RESEARCH-VALIDATION-GENIESPHERE-PRIVATE-001-RESULT.md` (segment B scores highest; mass-affluent household apps are cheap and crowded; affluent buyers pay for trust, setup and cross-domain attention, and will run security diligence).

**Addendum (2026-10-23, later):** the 0.1 pages now use the homepage's brand look instead of the legacy cyan, to fit the affluent target (ADR-013): DM Sans + Playfair Display (serif page and module titles), navy ink `#0B1435` on `#F6F8FF`, accent `#315BFF`, blue-violet gradient buttons (`#1234C7`→`#4934F4`), the cyan→blue→violet spectrum for emphasis (greeting word, module top bars, panel icons), the hero's full-width cyan/violet glow, and soft blue-tinted shadows. Status colours (ok/warn/urgent) are unchanged. CSS tokens and classes named `teal` were renamed `accent`.
