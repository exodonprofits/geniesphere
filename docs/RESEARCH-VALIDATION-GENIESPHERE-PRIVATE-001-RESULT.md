# Research & Validation 001 — Result: GenieSphere Private

| | |
|---|---|
| Brief | `docs/RESEARCH-VALIDATION-GENIESPHERE-PRIVATE-001.md` |
| Date | 2026-10-21 |
| Repo state audited | `main` @ `70e0659` + production Supabase schema (`pbojacnagutipfhcxltj`, schema/row counts only — no row contents read) |
| Decision | **VALIDATE FIRST** |

**Evidence labels used throughout**

- **[R]** repository / production fact, verified in this audit
- **[I]** independent evidence (press, filings, audited results, surveys, regulators)
- **[V]** vendor's own claim
- **[3P]** third-party directory / affiliate / comparison site (may be biased or stale)
- **[A]** analyst assumption or inference by this report — not evidence

No customer interviews were conducted. **There is zero direct demand evidence for GenieSphere Private.** Every demand statement below is about the market, not about GenieSphere.

---

## 1. Executive recommendation

**Do not build GenieSphere Private. Do not add a premium tier to the roadmap. Run a 60–90 day, near-zero-code validation of a narrower, modified hypothesis, delivered by Exodon as a service on top of the GenieSphere 0.1 skeleton.**

The original hypothesis

> GenieSphere Private = GenieSphere + private configuration + premium integrations + asset intelligence + higher privacy/support + optional human concierge

fails on four of its six terms today:

1. **"GenieSphere" (the base) does not exist yet.** 0.1 has one working module (Grocery) and a thin dashboard. Nutrition, Home, Tasks, Notifications, Settings are ~400-byte stubs; the AI gateway calls an endpoint that does not exist; `integrations/*` are empty folders [R]. The 0.1 plan's own gate — Phase 3 "run the system in real family use for several weeks" and Phase 4 "expand only from evidence" — has not been passed [R `docs/MIGRATION-PLAN.md`].
2. **"Higher privacy" cannot honestly be sold on the current platform.** Production shares one Supabase project across Salon, Rental, Arowana, HVAC/contractor, proposals, AskGenie247 and GenieSphere (~300 tables) and stores third-party API keys and broker OAuth tokens in plain text columns [R]. An HNW buyer's diligence would fail this.
3. **"Optional human concierge" is the part of this market with the worst track record.** Panasonic shut down Yohana (AI + human household assistant) after cutting its price from $249 to $129/mo and stating monetization and scaling were difficult [I]; Hello Alfred and Magic pivoted from consumer to B2B [I]. Profitable concierge (Ten Lifestyle, 22.2% adj. EBITDA) is B2B2C through banks, not direct-to-consumer [I].
4. **"Premium integrations / asset intelligence"** means bank/brokerage aggregation — the #1 complaint category in this market (broken connections, stale balances) [3P], with an unsettled regulatory basis (CFPB §1033 rule enjoined and being rewritten) [I], and a direct path into investment-adviser and GLBA exposure [I].

What survives is real and worth testing:

- **A price band exists.** Affluent households pay low-four-figures per year for software (Kubera Black ~$2,499/yr [3P]; Range $2,950–$9,950/yr flat [I]; BlackCloak $3–7k/yr for family cyber [3P]) and four-to-five figures per month for humans (dedicated EAs $1.5–3.6k/mo [3P/V]; household managers $75–100k+/yr [I/3P]; estate managers $150–250k+ [3P]).
- **No product found combines household operations** (properties, vehicles, vendors/staff, renewals, documents, family tasks) **with a private AI briefing** for the $1M–$30M household. Family-office software covers investments; vaults are passive storage; household apps are mass-market [V/3P/I].
- **GenieSphere's best idea is already in the repo:** the Overview "What needs attention today" briefing that aggregates signals across domains and other Genies [R `dashboard/overview.html`, new `index.html`].

**Modified hypothesis to validate** [A]:

> Busy multi-business / multi-property owners (Segment B, overlapping C) will pay Exodon a setup fee plus a recurring retainer to get a private, maintained "household + business attention briefing" — built on GenieSphere 0.1, fed by the specialized Genies they already use, staffed by Exodon (not a concierge team), with no bank aggregation and no advice.

If that cannot be pre-sold to a handful of real households, GenieSphere Private should be rejected.

---

## 2. Current-repo capability map

### 2.1 Active 0.1 skeleton [R]

| Area | Path | State |
|---|---|---|
| Canonical config → client → auth | `shared/js/app-config.js` → `gs-client.js` → `gs-auth.js` | Built (slice 1) |
| Login | `core/auth/login.html` | Built (email/password, safe `?next=`) |
| Household context | `core/household/household.js` | Built (current household, switcher) |
| Dashboard | `core/dashboard/index.html` | Built, thin: greeting, household switcher, 5 open `household_tasks`, module cards |
| Grocery | `modules/grocery/index.html` + migration 0004 | Built: shared list, RLS-scoped to household |
| Nutrition, Home | `modules/*/index.html` | Stubs (~490 bytes) |
| Tasks, Notifications, Settings | `core/*/index.html` | Stubs (~410 bytes) |
| Permissions, Files | `core/permissions/`, `core/files/` | Empty folders |
| AI gateway | `core/ai/ai-gateway.js` | Contract only; posts to `/api/ai`, which does not exist |
| Integrations (Salon, Rental, Arowana) | `integrations/*` | Empty placeholders |
| RLS | migrations 0003, 0004 | Household-member helpers fixed and verified |

### 2.2 Legacy domain hubs (live on the server, outside the 0.1 skeleton) [R]

| Hub | Size | Data actually read | Notes |
|---|---|---|---|
| `dashboard/overview.html` | 75 KB | `finance_transactions`, finance views, `business_profiles` | "Attention Needed Today", "Genie Insight", demo mode. Insights are **counts + templated sentences**, not AI |
| `dashboard/household.html` | 76 KB | `vehicles`, `user_bills`, `medications`, `home_maintenance_tasks`, `calendar_events` | Links to 164 household pages (CarGenie, InsuranceGenie, DocVault, CollegeGenie, etc.) |
| `dashboard/business.html` | 94 KB | `finance_transactions`, `business_profiles`, RPC `create_geniesphere_business` | **Calls `api.anthropic.com` directly from the browser** (no key sent; violates the AI-gateway rule; almost certainly non-functional) |
| `dashboard/finance.html` | 67 KB | `finance_transactions`, `user_bills`, `businesses`, finance views | Same direct Anthropic call |
| `dashboard/investment.html` | 56 KB | none directly; links 29 investment tools | Prompt examples include "covered call idea for NVDA", "suggest dividend stocks" — **advice-shaped** |
| `dashboard/leisure.html` | 50 KB | none directly | 482 leisure pages, 433 of them `travelplangenie` (overlaps Voyage Genie) |

Also: 14 legacy dashboard pages call `createClient()` directly (violates ADR-004) [R].

### 2.3 Production data model relevant to "Private" [R]

Tables already exist (mostly empty) for much of the premium scope:

- **Household ops:** `households`, `household_members`, `family_members`, `household_tasks`, `household_bills`, `household_documents`, `household_warranties`, `household_receipts`, `household_notifications`, `household_audit_logs`, `household_chores`
- **Vehicles:** `vehicles`, `household_vehicles`, `vehicle_insurance_policies`, `vehicle_registrations`, `vehicle_service_history`, `vehicle_loans`, `vehicle_documents`
- **Property:** `properties`, `property_insurance`, `property_tax_history`, `property_mortgage_activity`, `property_hoa`, `warranties`, `maintenance_requests`
- **Obligations:** `universal_obligations` + `obligation_payments` — *"shared obligation definitions across Household, Business, Investment, and Leisure"* (8 rows). This is the closest existing thing to a cross-domain attention engine.
- **Entities / accounts:** `entities` (with `ein_last4`), `entity_memberships`, `entity_relationships`, `financial_accounts` (`last4`), `bank_accounts` (`last_four`), `credit_cards` (`last_four`, balances, due dates)
- **Approvals:** `user_genie_suggestions`, `user_genie_approvals`, `user_actions_log` — scaffolding for a "prepare → user approves" loop
- **Concerning:** `user_api_keys.api_key` (5 rows) and `broker_accounts.access_token / refresh_token` are plain columns; encryption is not evident in the schema.

---

## 3. Already built / partial / missing matrix

| Capability | Built | Partial | Legacy-UI only | Planned, not built | Missing | Duplicative | Delegate to another Genie |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Auth, household context, switcher | ● | | | | | | |
| Shared tasks / notifications | | ◐ (table + 5-item list) | ● | ● | | | |
| Daily attention briefing | | | ● (Overview, rule-based) | | ● (AI, cross-Genie) | | |
| AI gateway (server side) | | | | ● | ● | ● (direct browser calls) | |
| Grocery | ● | | | | | ● (`grocery_items`, nutritiongenie pages) | |
| Nutrition | | | ● | ● | | ● | |
| Home maintenance / warranties / inventory | | | ● | ● | | ● | |
| Bills / obligations / renewals | | ◐ (`universal_obligations`) | ● | | | ● (`user_bills`, `household_bills`, `obligation_payments`) | |
| Vehicles | | ◐ (tables) | ● | | | ● (`vehicles`, `household_vehicles`, `vehicle_registration` vs `_registrations`) | |
| Multiple properties | | ◐ (tables, rental-oriented) | | | ● (personal residences, staff) | | Rental Genie (leases, tenants, rent) |
| Valuables (art, watches, jewelry) | | | | | ● | | |
| Household staff / vendors | | | | | ● | | |
| Document vault | | ◐ (`household_documents`, storage paths) | ● (`doc-vault.html`) | | ● (encryption, sharing, retention) | | |
| Family / estate records, adviser access | | | | | ● | | |
| Permissions / role-based family + adviser access | | ◐ (household RLS) | | ● (`core/permissions/`) | ● (adviser, staff, time-boxed) | | |
| Audit log | | ◐ (`household_audit_logs`, empty) | | | ● (staff-access log) | | |
| Business-owner overview | | | ● (business, finance hubs) | | ● (live signals) | | Salon Genie, HVAC Genie |
| Investment overview | | | ● | | | | **Arowana** (trading journal, roll coach, risk) |
| Bank/brokerage aggregation | | | ◐ (`broker_accounts`, unused) | | ● | | — (do not build) |
| Travel / leisure | | | ● (433 travelplangenie pages) | | | ● | **Voyage Genie** |
| Open Q&A / general assistant | | | | | | | **AskGenie247** |
| Genie adapters (Salon, Rental, Arowana) | | | | ● (empty folders) | ● | | |
| Billing / tiers | | | | | ● (out of scope per README) | | |

---

## 4. Customer segmentation

Scores are 1 (worst for GenieSphere) to 5 (best), **analyst judgement [A] informed by the cited evidence**, not measured data. "Acquisition difficulty", "implementation complexity" and "trust barrier" are scored inversely (5 = easy / low).

| Criterion | A. Affluent busy family | B. Entrepreneur / multi-business owner | C. HNW multi-property family | D. Family office / UHNW | E. Retired wealthy |
|---|:-:|:-:|:-:|:-:|:-:|
| Pain severity | 3 | **5** | 4 | 4 | 2 |
| Willingness to pay | 3 | 4 | 4 | 5 | 3 |
| Acquisition ease (inverse difficulty) | 3 | **4** | 2 | 1 | 2 |
| Recurring value | 3 | **5** | 4 | 4 | 2 |
| Implementation ease (inverse complexity) | 4 | 3 | 2 | 1 | 4 |
| Trust barrier (inverse) | 3 | 3 | 2 | 1 | 2 |
| GenieSphere fit | 4 | **5** | 3 | 1 | 2 |
| **Total / 35** | 23 | **29** | 21 | 17 | 17 |

**Reasoning**

- **B is the strongest segment** — and it is also the founder's own profile (salon owner, consultancy, multiple Genie products, rental/property interests). The cross-domain problem (business alerts + household obligations + investments in one briefing) is exactly what the new homepage demo shows ("Approve this week's payroll", "Home Internet due in 3 days", "NVDA dropped 4.2%") [R `index.html`]. Reachable through Exodon's existing client base and CPA/bookkeeper relationships [A]. Risk: B owners already pay for vertical software and may not want another app.
- **C** has real, expensive pain (estate managers cost $150–250k+ [3P]), but buyers expect white-glove service and security attestations [I], and reaching them is referral-gated [I].
- **D should be excluded.** Incumbents (Addepar ~$50–70k+/yr entry, Masttro, Eton/AtlasFive serving 665 families [V/3P]) own it; buyers demand SOC 2 Type II [I]; Deloitte reports 43% of family offices attacked in 12–24 months [I]. A one-founder static-site + shared-Supabase product cannot credibly enter.
- **A** is the mass-affluent GenieSphere 0.1 user — but it is already served cheaply by Monarch ($99–199/yr), Trustworthy ($120–480/yr), Cozi/Skylight/Hearth, and $20/mo general assistants [3P/V]. Good for core GenieSphere, weak for a premium tier.
- **E** has assets but lower operational load; its main need (estate/document organization, caregiver access) is served by Everplans/Trustworthy [V] and carries elevated UPL/elder-data risk [I].

**Market definition:** the brief's suggestion holds. **Complexity, not income, is the qualifier**: count of properties + businesses + vehicles + recurring vendors/staff + advisers. A top-5% income family with one home has little to gain over core GenieSphere [A].

---

## 5. Problem validation

| Problem | Evidence it is real | Evidence people pay to solve it | GenieSphere relevance |
|---|---|---|---|
| Cognitive load across many obligations | Household manager / EA market exists at $55–100k+ salaries and $1.5–3.6k/mo EA services [I/3P/V] | Yes — but they pay **people** | Core of the attention briefing |
| Multi-property maintenance, vendors, staff | Estate-manager salaries $150–250k+ [3P]; EstateSpace exists but has 1–2 reviews [3P] | Yes, mostly humans; software spend unproven | Gap; Home module + new depth |
| Renewals, insurance, documents | Vaults sell at $100–480/yr [V/3P] | Yes, low price | Partial (`household_documents`) |
| Net-worth / asset view | Kubera, Monarch, Empower, Addepar [V/3P] | Yes, $95–2,500/yr consumer; far more for FO | Delegate / manual only |
| Family cyber/privacy | Deloitte 43% FO attacked; BlackCloak/Ponemon 51% of orgs saw executive-targeted attacks [I] | Yes, BlackCloak $3–7k/yr [3P] | Not GenieSphere's product; a constraint |
| Travel and leisure | Fora $1B valuation, commission-funded [I] | Consumers mostly pay nothing directly | Delegate to Voyage Genie |

**Not validated:** that any of these customers would buy *software* (rather than people) for operations, that they would trust a new small vendor, or that GenieSphere's briefing would replace an existing habit. These are what the experiments in §17 test.

---

## 6. Competitive landscape

Condensed. Full sources in the appendix.

| Category | Player | Target | Price | AI / human | Strength | Weakness | Gap for GenieSphere |
|---|---|---|---|---|---|---|---|
| FO software | Addepar | RIAs, MFOs, SFOs | Not public; ~$50–70k+/yr entry est. [3P] | Software + implementation | Institutional standard | Cost, 1–12 mo implementation [3P] | None — do not compete |
| FO software | Asora | Small/mid SFO | From ~€800/mo [V] | SaaS | Public pricing | Investments only | Household ops |
| FO software | Eton AtlasFive | UHNW $500M+ | Not public; 665 families [V] | Software + outsourced staff | Back office | UHNW only | — |
| DIY wealth | Kubera | Self-directed affluent | ~$249/yr; Black ~$2,499/yr [3P] | Software | Global, alt assets | Stale connections [3P] | No ops/tasks |
| PFM | Monarch | Mass affluent | $99.99/yr; Plus $199/yr (Apr 2026) [3P] | Software + AI assistant | Household sharing | Trustpilot 2.3/5, connection breaks [3P] | No property/vendor/docs |
| PFM + advice | Range | Affluent | $2,950 / $5,950 / $9,950 flat/yr [I] | AI + humans, phasing out humans [I] | Proves flat-fee WTP | Regulated adviser | Proves ~$3k+ band |
| Vault | Trustworthy | Families | $120–480/yr [V/3P] | Software | "Family operating system" for docs | Thin independent reviews | No ops/briefing |
| Vault | Everplans / Prisidio | Families, end of life | $99.99 / $150/yr [V] | Software | B2B2C via advisers | Passive storage | — |
| Estate ops | EstateSpace | SFO/UHNW estate managers | ~$34/user/mo [3P] | Software | Staff/vendor/asset model | Very few reviews | Closest functional analog |
| Home | HomeZada, Centriq, Oply | Homeowners | Free–$149/yr [V/3P] | Software/AI | Maintenance, manuals | Single home, mass market | Multi-property |
| Family cyber | BlackCloak | Executives, HNW families | $3–7k/yr + per member [3P] | Software + humans | Proves HNW security spend | — | Partner, not competitor |
| General AI | ChatGPT / Gemini / Claude | Everyone | $20–250/mo [3P/I] | AI | Agents, memory, connectors | Independent tests: fails real-world bookings [I] | Private data model + continuity |
| AI EA | Martin, Lindy | Professionals | $21–200/mo [3P] | AI | Email/calendar agents | No SOC 2 (Martin, 2024) [3P] | Household domain |
| Family AI | Ohai, Skylight, Hearth, Cozi | Parents | $39/yr–$699 hw [V/3P] | AI | Calendar/meals | Mass market | — |
| AI + human | Duckbill | Households | $99–169/mo [V] | Humans + LLMs | Closest to "concierge" | No independent reviews; unverified shutdown/revenue claims [3P] | Cautionary |
| AI + human | Yohana (Panasonic) | Families | $249 → $129/mo, **shut down 2026** [I] | Humans + app | Corporate backing | Could not monetize/scale [I] | Cautionary |
| AI + human | Hello Alfred, Magic | Households | — | Humans | — | **Pivoted to B2B** [I] | Cautionary |
| Luxury concierge | Quintessentially, Knightsbridge Circle | HNW/UHNW | ~$1.5–20k/yr; £25–100k/yr [I, partly dated] | Human | High-touch | ≤5 clients/manager [I] | Not a software business |
| Concierge B2B2C | Ten Lifestyle (LSE) | Bank members | Paid by banks | Human + tech | 22.2% adj. EBITDA [I] | Needs bank distribution | Channel lesson |
| EA services | Athena, Prialto, Wing, BELAY, Boldly | Executives | ~$700–3,600/mo [V/3P] | Human | Proven demand | Labor-linear | Price umbrella |
| Travel | Fora | Travelers | Commission-funded [I] | Human advisors | $1B valuation | — | Delegate to Voyage Genie |

**Category conclusion:** the empty space is real but narrow — *operations + private AI briefing for complex households*. It sits between passive consumer tools and labor-heavy human services. Both neighbours are crowded; the gap itself is unproven [A].

---

## 7. Willingness-to-pay evidence

**Observed prices** (not GenieSphere demand):

| Price point | Who pays | Source |
|---|---|---|
| $95–199/yr | PFM (Monarch, Copilot, YNAB) | [3P] |
| $100–480/yr | Document vaults | [V/3P] |
| ~$2,499/yr | Kubera Black (DIY family office) | [3P] |
| $2,950–9,950/yr | Range flat-fee AI + human planning | [I] |
| $3,000–7,000+/yr | BlackCloak family cyber | [3P] |
| $1,188–2,028/yr | Duckbill AI + human tasks | [V] |
| $8,400–43,200/yr | Dedicated EA services | [V/3P] |
| ~€9,600+/yr | Asora small family office | [V] |
| $55k–250k+/yr | House / estate manager salaries | [I/3P] |
| 0.5–2% of AUM | Multi-family office | [3P] |
| ~$3M/yr avg | Single family office operating cost | [I] (J.P. Morgan 2026, n=333) |

**Pricing hypotheses** [A] — to be tested, not adopted:

| Offer | Hypothesis band | Anchor |
|---|---|---|
| Core GenieSphere (family) | $0–15/mo | Monarch, Cozi, Skylight |
| "Private" software-only tier | $1,500–3,000/yr | Kubera Black, Range Premium |
| Exodon setup (one-time) | $2,500–7,500 | Consultancy day-rates; **no market evidence gathered** |
| Exodon retainer (maintenance + monthly review, no concierge) | $300–800/mo | Below Duckbill-to-EA band, above software |
| Fractional human concierge | Not recommended | Yohana, Alfred, Magic outcomes |

The brief asks whether value sustains **$1,000+, $10,000+, or more per year**:

- **$1,000+:** plausible for Segments B and C. Comparable products exist.
- **$10,000+:** only with substantial human service or family-office scope. That is a services business, not software.
- **Higher:** this is family-office territory. Exclude it.

---

## 8. Business-model comparison

| Model | Margin | Scalability | Fit with "Skeleton, not Empire" | Trust requirement | Evidence | Verdict |
|---|---|---|---|---|---|---|
| A. Standard SaaS | High | High | Good once core exists | Medium | Crowded at $100–200/yr | Core GenieSphere later, not Private |
| B. Premium SaaS | High | Medium | Risky; pulls the roadmap toward integrations | High (SOC 2 expected) | Kubera Black, Range | Not yet; requires security work first |
| C. Setup fee + recurring membership | Medium–high | Low–medium | Good if setup is mostly configuration | High but relationship-based | Advisers, Range, Vanilla B2B2C | **Best candidate to validate** |
| D. AI + human concierge | Low | Low (labor-linear) | Poor | Very high (staff confidentiality, agency liability) | Yohana shut down; Alfred and Magic pivoted | **Reject** for now |
| E. Family-office custom implementation | Medium | Very low | Poor; becomes bespoke builds | Extreme | Incumbents dominate | **Reject** |
| Hybrid C + B later | — | — | Good | — | — | **Recommended path if validated** |

---

## 9. Product overlap analysis

| Premium need (brief §5) | Where it should live | Why |
|---|---|---|
| Personal chief of staff / daily attention briefing | **GenieSphere Core.** The Overview becomes the main experience | This is GenieSphere's actual product. It aggregates signals from every module and Genie |
| Multi-property / estate operations | GenieSphere **Home module**, extended to multiple residences, vendors and staff | Personal residences are household scope. Rental properties (leases, tenants, rent) stay in **Rental Genie**, which emits signals only |
| Personal asset intelligence (valuables) | Home module, as an "assets" sub-domain | New tables are needed. Keep it manual (photos, appraisal docs, insurer, renewal date). No valuations |
| Business-owner intelligence | **Adapters** to Salon Genie, HVAC Genie and Rental Genie | GenieSphere shows "payroll needs approval" and links out. It must not re-implement POS, payroll or leases |
| Finance organization | Core obligations (`universal_obligations`) and the bills/renewals view | Organizing and reminders only. No bill pay and no aggregation at first |
| Investment intelligence | **Arowana adapter**: a read-only summary and alerts | Arowana already owns the trading journal, roll coach and risk settings. GenieSphere must never recommend trades |
| Leisure / travel | **Voyage Genie adapter**: upcoming trips and deadlines | The 433 `travelplangenie` legacy pages duplicate Voyage Genie. Archive them |
| Open-ended Q&A | **AskGenie247** through the AI gateway | Keep general chat out of GenieSphere's data model |
| Family / legacy | Core documents plus permissions: "where is it, and who can see it" | Store and locate only. No drafting and no interpretation (UPL risk) |

**Rule** [A]: GenieSphere owns *attention, obligations, household records and permissions*. Specialized Genies own their domains and publish a minimal signal contract, such as `{source, title, due_at, severity, deep_link}`. This matches the README rule that integrations go through adapters "that expose only the minimum information needed" [R `docs/ARCHITECTURE.md`].

---

## 10. GenieSphere vs GenieSphere Private boundary

**Answers to the brief's product questions:**

- **Is GenieSphere already a personal operating system?** *Conceptually, yes. In software, no.* The concept, the cross-domain dashboards and a data model covering most of the premium scope already exist [R]. The working product is a login, a household switcher and a grocery list [R].
- **Should Overview become the main experience?** **Yes.** Design it around "What needs my attention today?" (Watch → Think → Prepare → user approves). Household, Business, Investment, Finance and Leisure should remain deeper domains underneath it. The legacy Overview and the new homepage already point this way [R]. This is a core GenieSphere decision, not a Private one. It should be validated in the 0.1 household alpha first.
- **What should Private add that regular GenieSphere does not?** If validated, very little software:
  - Done-for-you setup and data entry
  - Configuration for multiple properties, businesses and vehicles
  - Adviser/staff access with audit logs
  - A dedicated, isolated data project
  - A monthly human review
  - Priority support

  The service layer is the product.

**Classification of candidate features:**

| Configuration only | New module or Core capability | Adapter to another Genie | Do not build |
|---|---|---|---|
| Multiple properties, vehicles and entities (tables exist) | Attention briefing engine (Core) | Salon / HVAC: business alerts | Bank/brokerage aggregation (initially) |
| Obligation types and reminder lead times | Permissions: adviser and staff roles, time-boxed (Core) | Rental: lease and tenant events | Bill pay / moving money |
| Branding, module selection per family | Audit log of every read and write (Core) | Arowana: portfolio summary and risk alerts | Trade ideas, allocations, "should I" answers |
| Notification channels | Vendors and staff registry (Home) | Voyage: trip deadlines | Will/trust drafting or interpretation |
| Isolated Supabase project per Private client | Valuables registry, manual (Home) | AskGenie247: general Q&A | Human concierge team |
| | Document vault hardening: private buckets, signed URLs, optional client-side "sealed" docs | | Biometrics, real-time location |

- **Should Exodon provide setup and customization?** **Yes.** This is the most defensible part (§11).
- **Should human concierge be part of the premium model?** **No.** Exodon staff can do setup and a monthly review. Task execution (bookings, calls, payments) should stay with the client's own EA or house manager, or with partners. This avoids the labor-margin trap and agency liability [I/A].
- **What should GenieSphere never store?** See §12.
- **Which features create risk?** See §13.

---

## 11. Relationship to Exodon Profits

**Recommendation:** at first, GenieSphere Private is **an Exodon service offering, not a GenieSphere product tier**.

- **Exodon sells and delivers:**
  - discovery
  - data setup
  - Genie connections
  - a monthly "attention review"
  - small custom adapters
- **GenieSphere stays one product with one codebase.** Anything built for a Private client must land as a general Core or module capability, or as configuration. No client-specific forks. This preserves ADR-002/003 [R].
- **Why this fits:**
  - Exodon already does consulting and done-for-you deployment; EasyNailSpa deploys Salon Genie for salons [A, from founder profile].
  - Setup fees fund the work.
  - Customer learning feeds the core roadmap.
  - Nothing is committed to a premium-tier billing system that 0.1 explicitly excludes [R README].
- **When to promote it to a tier:** only after three or more paying clients use the same configuration with little custom work, and the security prerequisites in §12 are met.

---

## 12. Privacy and security requirements

**Prerequisites before any client outside the founder's household is onboarded** [R + I]. These apply even to a validation pilot that stores client data.

1. **Isolate client data.** Use a separate Supabase project per Private client, or at minimum one dedicated GenieSphere project. It must not share a database with Salon POS, Rental tenants, HVAC or Arowana [R]. Supabase is SOC 2 Type 2, but that covers only its own controls, not the application [I].
2. **Remove plaintext secrets.**
   - `user_api_keys.api_key` and `broker_accounts` tokens should move to Supabase Vault or a server-side secret store. Better still, drop bring-your-own-key entirely [R/I].
   - Note: pgsodium column encryption is pending deprecation [I].
3. **Route every AI call through a server-side gateway.**
   - Paid API tiers only.
   - Zero data retention where the provider offers it.
   - Strip identifiers before sending.
   - List each LLM provider and n8n as a subprocessor.
   - Relevant provider terms: OpenAI does not train on API data by default and keeps abuse logs up to 30 days; Anthropic deletes API data within 30 days with exceptions [I].
   - Remove the direct browser `api.anthropic.com` calls [R].
4. **Require MFA for all users.** Passkeys are preferred.
5. **RLS and logging.**
   - RLS on every exposed table.
   - Private storage buckets with signed URLs.
   - Immutable audit log, including Exodon staff access, visible to the client.
6. **Family and adviser permissions.** Permission-aware family/adviser/staff roles with time-boxed, revocable delegation.
7. **Data control and response.** Export and deletion on request, a written incident-response plan, and backups/PITR.
8. **Breach notification readiness.**
   - Illinois PIPA: notify the AG if more than 500 IL residents are affected [I].
   - FTC Safeguards Rule: notify within 30 days at 500+ consumers, if covered [I].
9. **SOC 2 path.** Readiness, then Type I, then Type II, before marketing to Segments C and D. Buyers there expect Type II [I].
10. **Marketing claims.** No "bank-grade", "military-grade" or "never sees your data" claims unless provable. FTC Operation AI Comply applies [I].

**Never store** [I]. Enforce this in code with input validators, not only in policy.

| Never store | Store instead |
|---|---|
| Bank/brokerage usernames and passwords | Nothing, or a tokenized aggregator link later |
| Full card numbers, CVV, PINs (PCI DSS) | Issuer + last 4 (current schema already does this [R]) |
| Full SSN/TIN, raw passport or driver's licence images | Last 4 + "original kept in safe / attorney" |
| Crypto seed phrases, private keys | Custodian name only |
| Medical records, diagnoses (FTC Health Breach Notification Rule) | Provider name + where records are kept. The legacy `medications` usage should be reviewed [R] |
| Biometric templates (Illinois BIPA, $1,000–5,000 per person) | Device-native passkeys / Face ID only |
| Safe, alarm or gate codes; real-time location | Nothing |
| Children's data beyond what parents enter (COPPA, amended 2025) | Parent-entered records, no child accounts |
| Full travel itineraries tied to home addresses (physical-security risk) | Dates + deep link to Voyage Genie |

---

## 13. Regulatory and safety risks

General information, not legal advice. **Items marked ⚖ need counsel before launch.**

| Feature | Risk | Severity | Mitigation |
|---|---|---|---|
| Investment hub prompts ("covered call idea for NVDA", "suggest dividend stocks") [R] | Investment Advisers Act: compensation + "in the business" + personalized advice. Algorithmic advice is treated the same as human advice [I] ⚖ | **High** | Block securities recommendations at the gateway. Read-only facts only. Delegate to Arowana, whose own positioning must also be reviewed |
| Bank/brokerage aggregation | GLBA "financial institution" → FTC Safeguards Rule (MFA, encryption, qualified individual) [I]; Plaid developer-policy duties [I]; §1033 uncertainty [I] ⚖ | High | Do not aggregate in validation. Manual or CSV entry only |
| Bill pay, staff paying on client's behalf | State money-transmitter licensing; agency liability [I] ⚖ | High | Never touch funds. Reminders and deep links only |
| Estate/legal documents | Unauthorized practice of law (*Janson v. LegalZoom*) [I] ⚖ | Medium | Store and locate only. Refer to attorneys |
| Medications, health notes [R] | FTC Health Breach Notification Rule: sharing with an LLM or tracker can itself be a breach [I] | Medium–High | Do not include in Private scope. Exclude from AI context |
| Face/photo features | Illinois BIPA [I] ⚖ | High | No server-side biometrics |
| Child profiles | COPPA (amended rule, compliance by Apr 22, 2026) [I] | Medium | Parent-controlled records only |
| AI "concierge" bookings | Liability for wrong bookings; FTC AI-claims enforcement [I] | Medium | Prepare-and-approve, never autonomous spend |
| Human staff access | FCRA + Illinois background-check rules, NDAs, insider risk [I] ⚖ | Medium | Exodon staff only, logged, client-granted access |
| Single shared database [R] | Cross-product blast radius; physical-security exposure for HNW data [I] | **High** | Isolation (§12.1) |

---

## 14. Technical feasibility

| Item | Feasible on current stack? | Effort | Notes |
|---|---|---|---|
| Attention briefing (rule-based) over `household_tasks`, `universal_obligations`, bills, vehicles, property dates | Yes | Low–medium | Data model exists [R]. This is a 0.1 Core task anyway |
| AI summarization of the briefing | Yes, after a server-side gateway (Supabase Edge Function) | Medium | Gateway is planned but not built [R] |
| Genie adapters (signals only) | Yes | Medium per Genie | Same Supabase project today, which makes it easy but unsafe. Becomes harder after isolation (needs an API/Edge Function contract) |
| Per-client isolated projects | Yes | Medium | Duplicates migrations. The deploy is static, so one front end can point at multiple projects via config [A] |
| Adviser/staff permissions + audit | Yes | Medium–high | New Core work |
| Client-side encrypted vault | Possible | High | Conflicts with AI/staff readability. Offer as an opt-in "sealed" class |
| Aggregation (Plaid etc.) | Possible | High + recurring cost + compliance | Not recommended |
| SOC 2 | Process, not code | High (cost and time) | Required only for Segments C/D at scale |

**Feasibility verdict:** the *validation* version is buildable with 0.1 work that is already on the roadmap: the briefing, the gateway, permissions and the Home module. The *full* hypothesis is not feasible for a one-founder operation without abandoning the 0.1 discipline [A].

---

## 15. Acquisition and sales-channel analysis

| Channel | Evidence | Fit |
|---|---|---|
| Founder's existing network and Exodon clients (business owners) | Segment B overlap [A] | **Best for validation.** Near-zero CAC |
| CPAs, bookkeepers, estate attorneys, wealth advisers (referral / B2B2C) | 46% of HNW investors found their adviser by referral [I, vendor survey]; CPAs/attorneys are the top sources for the wealthiest clients, but only ~1 in 5 advisers succeed at building those relationships [I] | Strong but slow. Partners will diligence security |
| Banks/cards (B2B2C concierge) | Ten Lifestyle, Capital One/Velocity Black, Amex [I] | Out of reach |
| Paid digital / DTC | Concierge DTC has the worst track record [I]; adviser CAC proxy ~$2.5–3.8k per client [I] | Poor |
| Other Genie products (Salon Genie / EasyNailSpa salon owners) | Existing relationships [A] | Good for Segment B |

---

## 16. Red-team findings

| Challenge | Finding | Verdict |
|---|---|---|
| ChatGPT + existing apps already solve enough? | For Segment A, largely yes: $20/mo agents with memory, plus Monarch, Trustworthy and Cozi [3P/V]. They fail at persistent, structured household state and real-world execution [I], but GenieSphere also lacks execution | **Partly true.** Premium value must come from structure, continuity and service, not from AI |
| Would HNW customers trust GenieSphere? | Not today. One shared DB, plaintext keys [R]; only 46% globally trust AI [I]; FO buyers expect SOC 2 Type II [I]; 28% of FOs cite cyber/privacy as a top AI barrier [I] | **True today.** Fixable for B/C via isolation and relationship-based trust; not fixable for D |
| Acquisition costs too high? | DTC yes; referral/B2B2C slow; founder network cheap but small [I/A] | **True at scale**, false for a pilot |
| Concierge destroys margins? | Yohana shut down, Alfred and Magic pivoted [I] | **True.** Exclude concierge |
| Integration complexity excessive? | Aggregation is the #1 complaint category and has regulatory drag [3P/I]; Genie adapters are simpler but none exist [R] | **True for aggregation**, manageable for Genie signals |
| Market too narrow? | Many US millionaires [I], but "complex household + pays for software + reachable" is unmeasured | **Unknown.** That is why this is VALIDATE FIRST |
| Product becomes unfocused? | Legacy already sprawls: 776+ pages across hubs, duplicate tables, 433 travel pages [R] | **High risk.** A premium tier would accelerate sprawl |
| Family-office vendors own the category? | Yes for D (Addepar, Masttro, Eton) [V/3P]. None own household operations | **True for D only** |
| Should Exodon just offer this as a service? | Lowest risk; uses existing assets; matches what survives scrutiny [A] | **Yes.** This is the recommendation |
| Is GenieSphere Private just an overcomplicated dashboard? | The five-dashboards framing, yes. The attention-briefing framing, no | Reframe around the briefing |

**Strongest case against the whole idea** [A]: the founder already runs Salon Genie, Rental Genie, HVAC Genie, Voyage Genie, Arowana, AskGenie247, EasyNailSpa, a salon and a consultancy. A premium HNW tier adds a demanding trust and service obligation to a product whose 0.1 skeleton is unfinished. The opportunity cost may exceed the opportunity.

---

## 17. Low-cost validation experiments

All are near-zero code and do not change the roadmap. Run them in order; each has a kill criterion.

| # | Experiment | Method | Success | Kill |
|---|---|---|---|---|
| 0 | **Dogfood the briefing** | Founder uses GenieSphere 0.1 daily for 4 weeks (the existing Phase 3), logging what belongs in "what needs my attention today" across salon, rentals, Arowana and household | ≥ 5 recurring cross-domain items per week that no current app surfaces together | Founder stops opening it |
| 1 | **Problem interviews** | 12–15 Segment B/C prospects via the founder's network, Exodon clients and 2–3 CPAs or estate attorneys. Ask about past behaviour, not hypotheticals: what they pay people or tools for today, and the last missed renewal or deadline and its cost | ≥ 6 rate pain ≥ 4/5 **and** already pay someone (EA, house manager, bookkeeper) for coordination | < 3 with pain ≥ 4 |
| 2 | **Concierge MVP ("Household Briefing")** | For 3 households, Exodon builds the obligation/property/vehicle/vendor inventory by hand (spreadsheet or the existing tables in an **isolated** project), then sends a weekly email briefing written by a human with AI assist | ≥ 2 of 3 say they would be upset to lose it after 6 weeks; time cost ≤ 2 hrs/household/week after setup | Time cost does not fall after week 3 |
| 3 | **Price test / pre-sale** | Offer a paid pilot: setup $2,500–5,000 + $300–800/mo [A hypothesis], refundable deposit | ≥ 2 paid deposits within 60 days | 0 deposits after 8+ qualified pitches |
| 4 | **Channel test** | Ask 3 CPAs/attorneys whether they would refer clients, and what security proof they need | ≥ 1 partner willing to refer | All require SOC 2 before any referral (then the channel is HOLD until SOC 2) |
| 5 | **Trust test** | In interviews and pilots, show the "never store" list and data-isolation plan; note objections | Objections addressable without SOC 2 for Segment B | Segment B also requires SOC 2 → HOLD |

**Budget:** founder/Exodon time plus a separate Supabase project for pilot data. No new product code beyond what 0.1 already plans [A].

---

## 18. Scorecard

1 = poor, 5 = strong. Scores are analyst judgement [A], with the evidence basis noted.

| Dimension | Score | Basis |
|---|:-:|---|
| Customer pain (Segment B/C) | 4 | Human staff spend [I/3P] |
| Willingness to pay (software) | 3 | Kubera Black, Range [3P/I]; no direct evidence |
| Willingness to pay (service) | 4 | EA and house-manager spend [I/V/3P] |
| Differentiation | 3 | Household ops + briefing gap [A]; easily copied by large AI platforms |
| Strategic fit with GenieSphere | 4 | Overview/briefing concept already in the repo [R] |
| Fit with "Skeleton, not Empire" | 2 as hypothesised / 4 as modified | Premium tier invites sprawl; service model does not |
| Technical readiness | 1 | 0.1 not finished; shared DB; plaintext secrets [R] |
| Trust / security readiness | 1 | §12 prerequisites unmet [R] |
| Regulatory exposure | 2 | Advice, aggregation, health, BIPA lines [I] |
| Acquisition feasibility | 3 | Founder network + referral channel [I/A] |
| Unit economics (no concierge) | 3 | Setup + retainer plausible [A] |
| Unit economics (with concierge) | 1 | Yohana / Alfred / Magic [I] |
| Evidence of demand for GenieSphere specifically | 1 | None gathered |

---

## 19. Final decision

# VALIDATE FIRST

**Why not GO:**
- No demand evidence specific to GenieSphere.
- The base product is unfinished.
- The trust and security prerequisites are unmet.

**Why not MODIFY:** the modified concept is itself an unvalidated assumption, so modifying it and then building would skip the evidence the 0.1 plan requires.

**Why not HOLD:**
- The validation is cheap.
- It overlaps with work the roadmap already requires: the Phase 3 household alpha and the attention briefing.
- It can produce evidence within 60–90 days.

**Why not REJECT:** a real price band and an unoccupied household-operations gap exist [I/3P/V], and GenieSphere's attention-briefing concept fits that gap.

**What is rejected now, regardless of validation:**
- human concierge as part of the model
- family-office / UHNW (Segment D)
- bank/brokerage aggregation
- any advice, bill-pay, or legal-document features
- a separate GenieSphere Private codebase or billing tier

**Brief §16 outcome:** the current best answer is **D: Exodon provides this as a custom service on top of GenieSphere**, with a path to **B: a premium tier but not a separate business** only if the §17 experiments pass and the §12 prerequisites are met.

**Roadmap:** no change. The 0.1 sequence stands: Core, then Nutrition / Grocery / Home, then the household alpha. The one recommended emphasis is to treat the Overview "what needs my attention today" briefing as the 0.1 dashboard's primary purpose. That stays within current scope (shared dashboard, tasks, notifications).

---

## 20. Recommended next agent / handoff

**Next agent: Customer Discovery Agent (no code).**

- **Inputs:** this report, §4 segments B/C, §17 experiments 1, 3 and 4.
- **Deliverables:**
  - an interview guide
  - a prospect list template
  - a one-page pilot offer
  - an interview log format
  - a results write-up, `docs/RESEARCH-VALIDATION-GENIESPHERE-PRIVATE-002-DISCOVERY.md`, with a go/kill call against the §17 criteria
- **Constraints:**
  - no product changes
  - no pricing published
  - no client data stored outside an isolated project

**Separate, independent of this decision:** the following came out of the audit and are worth raising with the GenieSphere 0.1 refactor agents. They apply whether or not Private ever exists. They are listed here for prioritisation only; none was changed by this research.

1. Remove the direct browser calls to `api.anthropic.com` in `dashboard/business.html` and `dashboard/finance.html`. Route them through the AI gateway once it exists.
2. Plan the move of `user_api_keys.api_key` and the `broker_accounts` tokens out of plain columns.
3. Remove advice-shaped prompts from `dashboard/investment.html`, or move the investment hub behind Arowana's positioning review.
4. Record an ADR on data isolation: GenieSphere household data versus the other Genies in the shared Supabase project.
5. Mark `leisure/travelplangenie/*` (433 pages) as a Voyage Genie duplicate for archiving under the legacy migration rule.

---

## Appendix — Sources

**Repository / production [R]:** `README.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/ACTIVE-PAGES.md`, `docs/MIGRATION-PLAN.md`, `docs/DECISIONS.md`, `index.html`, `dashboard/{overview,household,business,investment,finance,leisure}.html`, `core/`, `modules/`, `integrations/`, `supabase/migrations/0001–0004`. Production Supabase `public` schema: table list, row counts and column names only.

**Family-office, wealth and PFM software:**
kubera.com/blog/addepar-pricing ·
capterra.co.uk/software/1037191/addepar ·
asora.com/pricing ·
asora.com/compare/masttro ·
businessabc.net/best-masttro-alternatives-for-family-offices-a-2026-evaluation-guide ·
andsimple.co/companies/altoo ·
hubbis.com (Eton Solutions) ·
familywealthreport.com (Eton "Administrative Family Office") ·
businesswire.com/news/home/20240710134450/en ·
copiawealthstudios.com/pricing ·
solanacompass.com/projects/kubera ·
finder.com/kubera-review ·
thecollegeinvestor.com/36895/kubera-review ·
justvanilla.com/pricing ·
fintechfutures.com (Arch Series B) ·
thepennyhoarder.com/budgeting/monarch-money-review ·
waypointbudget.com/blog/ynab-vs-monarch-money ·
checkthat.ai/brands/monarch/reviews ·
mezzi.com/blog/copilot-money-2026-pricing-change-what-annual-subscribers-should-do ·
investmentnews.com (Origin; Range advisor workforce) ·
nerdwallet.com/financial-advisors/reviews/range ·
sacra.com/research/range ·
scalevp.com (Range $60M)

**Vaults, home and estate operations, cyber:**
trustworthy.com ·
katheats.com/trustworthy-review ·
everplans.com/pricing ·
prisidio.com/plans ·
capterra.com/p/250213/EstateSpace ·
zen.homezada.com ·
thisoldhouse.com (Centriq) ·
getapp.co.uk/software/2056511/blackcloak ·
securityweek.com (BlackCloak $17M) ·
lighthouse-careers.com (estate manager salary 2026) ·
spearswms.com (Morgan & Mallet) ·
content.knightfrank.com (estate staff salary survey 2022)

**Market size and willingness to pay:**
deloitte.com (family office count; family office cybersecurity report) ·
privatebank.jpmorgan.com/nam/en/insights/reports/2026-family-office-report ·
privatebank.citibank.com/insights/the-costs-of-running-a-family-office ·
longangle.com/blog/family-office-vs-wealth-manager-20m ·
euronews.com/2026/07/27/world-wealth-report-two-million-more-people-became-millionaires-in-2025

**AI assistants, AI + human, concierge:**
techcrunch.com/2025/05/20/google-ai-ultra-… ·
androidcentral.com (Gemini $100 plan) ·
seranking.com/blog/chatgpt-agent-digital-marketing-review ·
morganlewis.com/blogs/sourcingatmorganlewis/2026/08/ai-concierge-services-who-is-liable-when-a-bot-books-the-wrong-vacation ·
aiagentrank.io/blog/martin-ai-review-2026 ·
eesel.ai/blog/martin-ai-review ·
skylightframe.com ·
hearthdisplay.com ·
getduckbill.com ·
forerunnerventures.substack.com ·
simplify.jobs/c/Duckbill-Technologies (unverified claims) ·
holdings.panasonic/…/20260204_j.pdf ·
toyokeizai.net/articles/-/934705 ·
channelnews.com.au (Panasonic consumer apps) ·
en.wikipedia.org/wiki/Hello_Alfred ·
propmodo.com (Alfred) ·
quintessentially.com/terms-and-conditions ·
tempusmagazine.co.uk (Knightsbridge Circle) ·
capitalone.com/about/newsroom/velocity-black-acquisition ·
tenlifestylegroup.com (FY2025 results; H1 2026 interim) ·
prialto.com/faq ·
wingassistant.com/blog ·
pavillionagency.com ·
skift.com (Fora $1B) ·
luxurydaily.com (Inspirato Q3)

**Trust and channels:**
kpmg.com (Trust in AI 2025) ·
marketingprofs.com (Pew 2025) ·
empower.com/the-currency (AI trust research) ·
stories.td.com (2026 TD AI Insights) ·
businesswire.com/news/home/20230712308488/en (Dynasty Connect) ·
wealthprofessional.ca (adviser referral sources) ·
kitces.com (client acquisition cost) ·
americanbanker.com (Kitces marketing ROI)

**Regulatory and security:**
blogs.orrick.com/financial ·
wsgr.com (information vs advice) ·
dechert.com (2021 SEC robo-adviser risk alert) ·
orrick.com (fintech federal privacy) ·
bradley.com, perkinscoie.com (FTC Safeguards Rule) ·
thompsoncoburn.com (FTC breach notice) ·
openbankingtracker.com/guides/section-1033-status ·
cooley.com (CFPB 1033 reconsideration) ·
consumerfinancemonitor.com/2026/08/06 (1033 to OIRA) ·
plaid.com/developer-policy ·
moderntreasury.com (money transmission) ·
blog.ericgoldman.org (Janson v. LegalZoom) ·
hhs.gov (health apps and HIPAA) ·
hoganlovells.com (FTC Health Breach Notification Rule) ·
gtlaw.com (BIPA SB 2979) ·
ilga.gov (Illinois PIPA) ·
mofo.com, skadden.com (CCPA regulations) ·
federalregister.gov/documents/2025/04/22/2025-05904 (COPPA) ·
beneschlaw.com, cyberscoop.com (FTC Operation AI Comply / Workado) ·
blackcloak.io (2025 Ponemon report) ·
developers.openai.com/api/docs/guides/your-data ·
privacy.claude.com ·
platform.claude.com/docs/en/build-with-claude/api-and-data-retention ·
ai.google.dev/gemini-api/docs/billing ·
supabase.com/docs/guides/security/soc-2-compliance ·
supabase.com/docs/guides/platform/hipaa-projects ·
supabase.com/docs/guides/auth/row-level-security ·
supabase.com/docs/guides/database/extensions/pgsodium ·
pcisecuritystandards.org (SAD storage FAQ) ·
littler.com (Illinois criminal history checks)

**Caveats:**
- Several vendor sites could not be fetched directly, so their prices come from search-indexed copies and third-party listings.
- Verify any price on the vendor's own page before relying on it.
- Duckbill's shutdown and revenue claims are unverified.
- The current status of the CFPB 1033 proposed rule and Gemini retention terms should be re-checked.
- Regulatory items are general information, not legal advice.
