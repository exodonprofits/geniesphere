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

## ADR-014 — GenieSphere AI gateway and the Nutrition → Grocery interface

**Decision:** AI for 0.1 goes through one Edge Function, `gs-ai-gateway` (`supabase/functions/gs-ai-gateway`), called only via `core/ai/ai-gateway.js`. The function verifies the session and household membership, accepts allowlisted tasks only, builds prompts server-side from validated fields (the browser cannot send a prompt), reserves a call against a per-household daily limit before calling the model (`gs_ai_usage_reserve`, atomic), and checks and trims the model's output. It calls OpenAI (`gpt-4o-mini`, JSON mode) with the project's existing key; the meal-plan prompt is ported from the n8n "Meal Planner Fixed" workflow, which is no longer in the path. Meals and grocery items that may contain a selected allergen are flagged (`allergenWarning`), not dropped. Modules call other modules through small published interfaces: Nutrition adds groceries with `GenieSphere.grocery.addItems` (`modules/grocery/grocery-api.js`) and never writes shopping tables directly.

**Reason:** The legacy path posted from the browser to an unauthenticated public n8n webhook and kept plans in localStorage. The existing `ai-proxy` function is a good model but is scoped to salons (`business_id`, `salon.*` usage tables). A household-scoped gateway keeps keys and prompts server-side, caps cost per household, and makes adding AI tasks a server change. The salon-scoped design and n8n remain for Salon Genie and automations.

**Addendum (2026-11-08):** after the first live plan (Sunday; 1,200 kcal; 3 different dinners; ~80 s), the gateway prompt sets a calorie target per goal (balanced 2,000 kcal per adult per day, lighter 1,600, high-protein 2,200, etc., split across the chosen meals), requires 7 different dinners and lunches, and asks for shorter meals (≤8 ingredients, ≤4 steps). The gateway averages macros from the meals themselves, and gives a plan with repeated dinners/lunches or calories outside 75–130% of target one corrective attempt on the same usage reservation, only when the first call finished in under 60 s (Edge Function time limit). The page plans next week from Friday on, with a This week / Next week switch.

**Addendum (2026-11-08, second live plan):** the full-week retry never ran in practice (the first call takes ~80 s, the request limit is 150 s), and the model copied the per-meal calorie targets into every dish and used chicken at 6 of 7 dinners. The gateway now reviews each plan and makes at most one short repair call (≤4,000 tokens, ≤40 s, started only before 105 s) that replaces just the flagged meals and/or re-estimates the figures: meals that may contain a selected allergen, repeated lunches/dinners (or a breakfast/snack a third time), a fourth dinner on the same main protein, and meal types whose calories are all identical. The repaired plan is re-checked and kept only if it is no worse; a failed repair keeps the first plan. Each run logs its time, tokens and outcome. The prompt also asks for varied proteins and per-dish estimates.

**Addendum (2026-11-08, phone run):** a 109 s run (first call + repair) finished on the server, but the phone saw "Failed to send a request to the Edge Function": the proxy in front of Edge Functions drops a response that sends nothing for about 100 s, so the paid-for plan was lost. After the usage reservation the gateway now streams: status 200 at once, a space every 5 s, then the JSON (`{ ok: false, error }` for failures, which `ai-gateway.js` already shows). The same run's repair re-estimated the figures down to 971 kcal/day; a repair that pushes calories out of range is now rejected, and a re-estimate resizes portions (ingredient amounts) to the meal averages before estimating.

## ADR-015 — GenieSphere 0.1 runs on its own Supabase project

**Decision:** The canonical 0.1 pages (`core/`, `modules/`) use the dedicated **GenieSphere** Supabase project (`nxgtefbqizvihwikqnaw`), set in `window.GenieSphereConfig` in `shared/js/app-config.js`. Legacy pages keep reading `/shared/config.json`, which stays on the shared **Salon Genie** project (`pbojacnagutipfhcxltj`, formerly "Exodon Profits"), because their tables only exist there. `scripts/package_site.py` no longer requires the two to match; it refuses to ship if the canonical client is pointed anywhere but the GenieSphere project. The new project holds only the household core (households, members, context, tasks, notifications with the 0003/0005-style RLS), shopping lists (0004) and Nutrition (0007), plus the `gs-ai-gateway` function with its own `OPENAI_API_KEY`. Accounts are invitation-only: users are added in the project's Auth dashboard, public sign-up is off, and the homepage and login no longer link to the legacy sign-up page (which writes to the old project).

**Reason:** ADR-013 requires data isolation from the other Genies before onboarding households outside the founder's. The shared project held ~300 tables across Salon, Rental and Arowana, and the other products are moving to their own projects too. Users and households are not copied from the old project: 0.1 had only the founder's test household, and copying `auth.users` between projects is not worth the risk. Migrations 0005/0006 targeted the old project; 0006 (`gs_user_preferences`) does not apply to the new one.

## ADR-016 — Household invitations by one-time link

**Decision:** Owners add people from Settings. The `gs-household-invite` Edge Function creates a random 256-bit token, stores only its SHA-256 in `household_invites` (bound to one email, 7-day expiry, at most 10 open per household, a new link for the same email revokes the old one) and returns the token once; the owner sends the link (`/core/auth/invite.html#t=…`) by text or the phone's share sheet. The token travels in the URL fragment, so it never reaches the web server or a Referer header. Opening the link, the invitee sets a password (an account is created for the invited email, already confirmed) or, if that email already has an account, signs in; the function claims the invite atomically before creating anything, then adds a `member` membership. All writes go through the function; browsers can read invitations (owners only, without `token_hash`) and member names/emails (members only). Every member has the same access; the only owner-only actions are inviting and revoking.

**Reason:** Accounts are invitation-only (ADR-015) and the project's built-in email only delivers to the team's own addresses, so an emailed invite would not reach a spouse or house manager. A link the owner sends needs no email provider and keeps the owner in control. Roles beyond owner/member wait until a module actually restricts something (showing roles that change nothing would mislead).

