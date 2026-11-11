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

## ADR-017 — Transactional email from invites@geniesphere.com

**Decision:** Invitations and password resets are emailed by the Edge Functions themselves, through SMTP on the Bluehost mailbox `invites@geniesphere.com` (port 465; Supabase blocks 25/587), with replies going to `info@geniesphere.com`. Templates and sending live in `supabase/functions/_shared/email.ts`; credentials are Edge Function secrets, never in the repo or browser. A dedicated send-only mailbox keeps `info@`'s password out of the server. If sending fails, invitations fall back to showing the link to the owner. Password reset uses Supabase's recovery link (`auth.admin.generateLink`) in our own email, answers the same whether or not an account exists, and sends at most one email per account per 5 minutes.

**Reason:** Supabase's built-in email only reaches the project team, so invites never reached the invitee and "Forgot password?" pointed at the old project. Using the domain's existing Bluehost mail needs no new vendor. If deliverability from shared hosting proves poor, the same module can switch to a provider (e.g. Resend) by changing the SMTP secrets.

**Addendum (2026-11-09):** the first live send through Bluehost SMTP was refused (`535 Incorrect authentication data`). `_shared/email.ts` now prefers the Resend API when `RESEND_API_KEY` and `FROM_EMAIL` are set, the provider Rental Genie already uses (better deliverability than shared-hosting mail, no mailbox password on the server); Bluehost SMTP stays as the fallback. Logs record which path sent (`via`).

## ADR-018 — Home Genie schedules maintenance through Core tasks

**Decision:** Home Genie 0.1 is a recurring maintenance schedule (`home_maintenance_items`: title, every N days, next due, last done; migration 0009), started from a checklist of 12 common jobs. It does not keep its own to-do list: the database function `home_sync_tasks` adds one Core `household_tasks` row (`source_module 'home'`, `source_ref 'home:<item id>'`, unique while open) for each item due within 7 days (Chicago date), closes it if the item is done early on the Home page, and deletes it if the item is removed. Triggers run it on every item change; a daily pg_cron job (11:05 UTC) catches items that come due as time passes. Completing a home task anywhere (Tasks page, later the dashboard) records the item done that day and schedules the next one; Undo puts the item back on the task's due date. The Tasks page becomes a real Core page (add, assign, complete/undo, groups by due date), used by every module through `core/tasks/tasks.js`.

**Reason:** CLAUDE.md puts tasks in Core and forbids duplicating task logic in modules; a household with a house manager needs one list of what's due, whoever or whatever created it. Doing the sync in the database keeps tasks right even when nobody opens the Home page and avoids two pages racing to create the same task. Home inventory, vendors, warranties and documents wait until the schedule is in use.

## ADR-019 — Notifications: database-created, emailed by gs-notify

**Decision:** Notifications are per person and created only on the server: a database trigger when a task is assigned to someone else (`notify_task_assigned`, one notification per task and assignee, re-raised on reassignment), and the `gs-notify` Edge Function for the weekly summary. Browsers can read their own notifications and set `read_at`, nothing else (migration 0010 removes the old member insert policy). `gs-notify` runs from pg_cron every 5 minutes, authenticated by a random secret generated into Vault by the migration (it never leaves the database or appears in the repo), and emails pending "assigned to you" notifications (only if the task is still open and still theirs) and, on Sunday from 5 PM Chicago time, each member's summary of tasks overdue or due in the next 7 days that are theirs or unassigned, once per week, nothing when there is nothing due. Each member chooses per household in `notification_prefs` (missing row = both on). A member can send themselves the summary now, at most every 10 minutes, which also checks email delivery.

**Reason:** Tasks only help if the right person hears about them without opening the app, and delegation (spouse, house manager) depends on "assigned to you" reaching the assignee. Creating notifications in the database means every page and module that assigns a task notifies the same way, and nobody can create or forge a notification from the browser. Email goes through the same `_shared/email.ts` and Resend setup as invitations. Push notifications, SMS and per-module alerts wait until email is proven.

## ADR-020 — Home Genie covers homes and vehicles

**Decision:** Vehicles join Home Genie instead of becoming a separate module. `household_assets` (migration 0011) lists the household's homes/properties and vehicles; vehicles are personal or business (homes and rentals: see ADR-021), with an optional "owned by" label (e.g. a business or LLC), and maintenance items belong to one. Each kind has its own checklist; vehicles add date-based renewals (registration, insurance, emissions), set up by expiry month, shown from 30–45 days ahead (`lead_days`) and moved on from the expiry date when renewed. Task titles name the asset ("Oil change · F-150"). Existing items moved to a "Main house". Time-based only: mileage intervals, VINs, keys and codes, and insurance or finance details are not stored.

**Reason:** The research's strongest segment owns several properties and vehicles, some through a business. Cars need the same thing homes do (recurring upkeep that turns into tasks and the weekly summary), so one scheduler serves both, and CLAUDE.md keeps a Vehicle module out of active development. Marking business assets lets an owner filter and hand them off without mixing them into personal upkeep; accounting and expense tracking stay out of scope.

## ADR-021 — Rental properties belong to Rental Genie

**Decision:** GenieSphere does not manage rental properties or business property. Home Genie's homes are the ones the family lives in (primary, vacation or second home) and are always personal; only vehicles can be marked business, because no other product tracks them and the family deals with them either way. Business premises (e.g. the salon) belong with that business. Everything about a rental (tenants, leases, rent, repair requests, vendors, expenses, insurance, property tax, and recurring upkeep of the building) lives in Rental Genie, its own repository (`exodonprofits/rentalgenie`) and its own Supabase project. The "rental" use and the rental checklist extras (walk-through, landlord insurance) were removed from 0011 before it was applied. GenieSphere never copies Rental Genie data. If a link is ever wanted, it is a one-way, read-only feed of deadline headlines (title, date, link back) that Rental Genie chooses to publish, with no tenant names or amounts, and needs an explicit request and its own ADR.

**Reason:** One owner per piece of data. Rental Genie already holds the rental's dates and runs its own reminders; tracking the same building in two apps means one goes stale. Every GenieSphere household member sees everything, so tenant and money data must not flow in. CLAUDE.md keeps Rental out of GenieSphere's active development.


## ADR-022 — Genie assistant, phase 1: brain, not hands

**Decision:** Genie (`/core/genie/index.html`, `core/genie/genie.js`) is a Core assistant that reads the household's data, answers, and proposes actions. It never acts on its own. The AI runs only in the `genie.chat` task of `gs-ai-gateway` (OpenAI `gpt-4o-mini`, the existing key, 30 questions per household per day). For each question the server checks membership, then builds the context itself with the service role, limited to that household: member first names; open tasks (title, due date, assignee) under short refs (T1, T2…); homes and vehicles (name, kind, business label); upkeep schedule; unchecked grocery items; this week's meal titles. It never sends emails, phone numbers, notes, descriptions, or anything financial. The model may return four proposal types: `task.add`, `task.assign` (by ref, mapped back to the id on the server), `grocery.add` and `draft`. The server rebuilds each proposal from validated fields. It drops unknown types, members not in the household, past dates, tasks that duplicate an open task's title, reassignments to the same person, and grocery items already on the list. The browser shows each proposal as a card. A change happens only when a person taps Approve, through `GS.tasks` and `GS.grocery` with that person's own RLS. Tasks can be undone. Drafts are copied or opened in Messages/Mail; GenieSphere sends nothing. The weekly briefing is computed in the browser without AI. The chat history lives only on the page (last 12 messages are sent) and is not stored.

**Reason:** The research segment wants delegation without losing control, and the "never store" list rules out anything that needs credentials or money. Proposals plus approval give useful help (planning, assigning, lists, drafting vendor messages) with no new write path: the AI cannot change data, and the existing services and RLS still decide what a person may do. Phase 2 ("hands": booking, sending, calling) needs its own ADR, per-action consent, and an audit trail.

## ADR-023 — Floating Genie on every page

**Decision:** Every app-shell page except the Genie page shows a floating Genie button (`gs-shell.js`). Tapping it loads Genie's scripts on demand (`ai-gateway`, `tasks`, `grocery-api`, `genie`, `genie-chat`; only the ones the page has not loaded) and opens the conversation in a sheet: almost full screen on phones, sized to the visible viewport so the input stays above the keyboard; a right-side panel on desktop. The conversation UI is one Core component, `core/genie/genie-chat.js`, used by both the sheet and the Genie page. The conversation follows the person between pages in `sessionStorage` (last 24 messages, text only, per household) and is gone when the browser tab closes; it is still never stored on the server. After an approved proposal or its undo, the component fires `gs:data-changed` (`tasks` or `grocery`), and the Dashboard, Tasks, Grocery and Genie pages reload their own lists. On phones the Genie tab leaves the bottom bar (5 tabs); the desktop top nav keeps it, and the sheet links to the full page.

**Reason:** Genie is most useful where the work is (add groceries from the list, assign from Tasks) without leaving the page. One component avoids two chat implementations drifting apart, and lazy loading keeps every other page as light as before. `sessionStorage` gives continuity across pages without adding stored personal data. ADR-022's rules (approve before any change, drafts never sent, the 30/day limit) are unchanged.


## ADR-024 — HTTPS only

**Decision:** The site is served only over HTTPS (Bluehost AutoSSL). `.htaccess` sends every http request to the same https URL with a 301, except `/.well-known/acme-challenge/`, which AutoSSL needs over http to renew the certificate. It also sends `Strict-Transport-Security: max-age=86400` (1 day) to start; raise it to `31536000` once AutoSSL has renewed the certificate at least once. Do not add `preload`. Email links default to `https://geniesphere.com` (`_shared/email.ts`, `gs-notify`). The functions deployed before this change still default to http; the redirect covers those links until the next deploy of `gs-notify`, `gs-password-reset` and `gs-household-invite`. Supabase Auth's Site URL and Redirect URLs must list the https addresses, or password-reset links are refused.

**Reason:** Logins and household data must never travel in plain text, and the target households will use public Wi-Fi.

## ADR-025 — Meal photo calorie estimate (Nutrition)

**Decision:** The Nutrition page has a "Snap a meal" card (`modules/nutrition/meal-photo.js`). The browser shrinks the photo to a JPEG of at most 768 px (about 100–200 KB) and sends it once through the AI gateway as task `nutrition.photo_estimate` (gpt-4o-mini vision, `detail: low`, 20 per household per day). The photo is never stored or logged, in the browser or on the server; only token counts go to `gs_ai_usage`. The server rebuilds the answer: up to 12 items, each with a portion and a calorie range plus protein/carbs/fat; the totals are computed in the browser from the items. Allergens are flagged only if they are on the household's saved allergy list (`household_nutrition_prefs`), from the model's report plus the existing allergen word check on item names. The card shows "May contain …" and never says a dish is safe. People can scale each item (¼× to 3×) or remove it, and the totals follow. Estimate only: there is no meal log. "Scan a plate" opens a full-screen live camera (`getUserMedia`, https only) with a square guide frame. The shutter crops the frame to that square, stops the camera at once, and shows a scan animation over the frozen frame while the gateway answers. Without a live camera (http, permission refused, older browsers) it falls back to the phone's camera app or a library photo.

**Reason:** Useful for "roughly how much was that" without building a diet tracker, which would store health-adjacent data per person (including children's). Ranges and the 20–40% note keep expectations honest. Photos of plates show the inside of the home, so they are not kept. A private per-person log needs its own ADR.

