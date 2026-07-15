# FastTrack — Design Spec

**Date:** 2026-07-15
**Status:** Draft, awaiting review
**Scope of this document:** Release 1 (R1) in detail. R2–R5 are listed as roadmap context and are explicitly out of scope for implementation.

---

## 1. Product

An iOS app for tradespeople — plumbers, electricians, contractors — to build estimates on the job site, convert them to invoices, and get paid. Plus a read-only web dashboard for financial position and budgeting.

### Positioning

Four incumbents were reviewed:

| Product | Rating | Ratings | Pricing | Shape |
|---|---|---|---|---|
| Invoice Simple | 4.9 | 123K | $6.99–$21.99/mo | Generic, wins on simplicity |
| Invoice Fly | 4.8 | 93K | $8.99/wk–$17.99/mo | Generic, aggressive pricing |
| Invoice Maker | 4.8 | 35K | $9.99/wk–$17.99/mo | Generic, mobile-only |
| Joist | 4.7 | 13K | $9.99–$31.99/mo + **$9.99/mo QBO add-on** | Contractor-specific |

**Do not fight Invoice Simple on simple invoicing.** They are better at it and have a decade's head start.

**The wedge: job profitability.** No competitor can answer "did this job actually make me money." This is a data model consequence, not a feature — competitors treat the invoice as the top-level object and only capture the *price*, so margin is unknowable. FastTrack captures cost and markup per line item, so margin is known the moment an estimate is built.

**Secondary wedges**, all sourced from competitor 1-star reviews:

- **Offline-first.** Joist's top complaint is data loss when backgrounding the app mid-estimate. Job sites don't have signal.
- **PDF fidelity.** Invoice Maker users report the preview not matching what the client receives.
- **QuickBooks included**, not a $9.99/mo add-on.
- **Spend dashboard + budgets.** Nobody has this.

---

## 2. Decisions

These are settled. Reversing any of them is expensive.

| # | Decision | Consequence |
|---|---|---|
| 1 | **Commercial product**, sold to tradespeople | Multi-tenant isolation, App Store subscriptions, per-customer QBO OAuth |
| 2 | **FastTrack tracks its own spend** (not read from QBO) | Own expense model; dashboard works without QuickBooks; must avoid double-counting on QBO push |
| 3 | **Record payments in R1, process cards later** | No Stripe Connect, no KYC, no payout surface in R1 |
| 4 | **Offline-first** | Local SQLite is source of truth; sync engine required |
| 5 | **Job-first spine** | `Job` is the top-level entity; estimates, invoices, expenses, photos hang off it |
| 6 | **Apple IAP at 15%**, not external purchase links | See §7 |

---

## 3. Architecture

### Constraint that drives everything

**The developer machine is Windows 11. Xcode is macOS-only.** Native Swift/SwiftUI is not viable without buying a Mac. React Native + Expo is the path: EAS builds iOS on Expo's macOS servers, triggered from Windows.

### Stack

**Monorepo** — pnpm workspaces + Turborepo.

- `packages/schema` — Zod validation + generated DB types
- `packages/core` — markup, tax, totals, profitability math. **Imported by both apps.** Margin math written once.

**Database — one Postgres, shared by both apps.**
Supabase: Postgres + Auth (Sign in with Apple, email) + Storage (photos, receipts, PDFs) + RLS for tenant isolation.

**iOS — Expo / React Native + TypeScript.**
- **PowerSync** for offline-first. Replicates Postgres → local SQLite per device; reads and writes hit local SQLite; writes queue in an upload buffer that drains on reconnect. **Do not hand-roll a sync engine.**
- `expo-print` for on-device PDF generation from an HTML template.
- `expo-camera` / `expo-image-picker` for photos and receipts.
- EAS Build for cloud iOS builds.

**Web — Next.js (App Router) + TypeScript.**
Read-only. Queries Supabase directly under RLS — no API layer. The design is already React, so it's a port.

**Backend — deliberately minimal.**
Supabase covers auth, storage, RLS, Postgres. PowerSync covers sync. Only email delivery and scheduled reminders need code in R1: Supabase Edge Functions + `pg_cron`. **A dedicated Node worker is added only when QBO lands (R4)** — its rotating refresh tokens and retry semantics need a real queue, and nothing before R4 does.

### PDF: on-device only

Rendered on the phone via `expo-print`. This satisfies two constraints simultaneously: offline estimating needs on-device rendering anyway, and if the phone renders the exact artifact the client receives, preview-vs-delivered drift is *structurally impossible*. Because web is read-only, there is no second renderer to drift from. Competitor complaint designed out rather than fixed.

---

## 4. Data model (R1)

### Rules

- **Money is integer cents.** Never floats. Anywhere.
- **`markup_pct` is integer basis points** (2500 = 25.00%), not a float. Markup multiplies against cost to produce a price a customer is charged; float drift here shows up as off-by-a-penny totals that don't reconcile against the PDF the client already received. Price = `round(unit_cost_cents * (10000 + markup_pct) / 10000)`, rounding half-up, applied once at write time.
- **Every table carries `org_id`.** RLS enforces isolation on it.
- **UUIDs are generated client-side.** Offline devices cannot reach a sequence.
- **Soft deletes (`deleted_at`).** Hard deletes do not sync.
- **`updated_at` on every row** for last-write-wins.
- **No server-generated values the client displays before sync.** See the invoice numbering risk in §7.

### Entities

```
organizations    id, name, logo_url, address, license_no, trade, tax_config, created_at
users            id, email, name
memberships      id, org_id, user_id, role
clients          id, org_id, name, email, phone, address, notes, deleted_at, updated_at
jobs             id, org_id, client_id, title, address, status, scheduled_at,
                 notes, deleted_at, updated_at
price_book_items id, org_id, kind(material|labor), name, unit, unit_cost_cents,
                 default_markup_pct, deleted_at, updated_at
estimates        id, org_id, job_id, number, status(draft|sent|viewed|accepted|declined|expired),
                 issued_at, expires_at, subtotal_cents, tax_cents, discount_cents,
                 total_cents, notes, terms, pdf_url, deleted_at, updated_at
estimate_lines   id, org_id, estimate_id, sort_order, kind, description, quantity,
                 unit, unit_cost_cents, markup_pct, unit_price_cents, is_taxable,
                 price_book_item_id, deleted_at, updated_at
invoices         id, org_id, job_id, converted_from_estimate_id, number,
                 status(draft|sent|viewed|partial|paid|overdue), issued_at, due_at,
                 subtotal_cents, tax_cents, discount_cents, total_cents,
                 balance_cents, notes, terms, pdf_url, deleted_at, updated_at
invoice_lines    (same shape as estimate_lines, invoice_id)
payments         id, org_id, invoice_id, amount_cents, method(check|cash|zelle|card_other),
                 paid_at, reference, notes, deleted_at, updated_at
photos           id, org_id, job_id, estimate_id?, invoice_id?, storage_path,
                 caption, taken_at, deleted_at, updated_at
signatures       id, org_id, estimate_id?, invoice_id?, storage_path, signed_by,
                 signed_at
```

### Two decisions worth defending

**Estimates and invoices are separate tables, not one polymorphic `documents` table.** They diverge — estimates expire and get accepted/declined; invoices have due dates, balances, and payment state. A shared table needs half its columns nullable. The *line item shape* is shared, but that sharing belongs in `packages/core`, not in the schema. Conversion copies rows and links via `converted_from_estimate_id`.

**Line items store both `unit_cost_cents` and `unit_price_cents` — snapshotted, not computed.** Price books change and markups change. A sent estimate must be immutable: it has to show the price *as sent*, forever. Recomputing from a mutated price book silently rewrites history and breaks the margin numbers the dashboard reports.

### Roadmap entities (not R1)

- **R2:** `expenses`, `expense_categories`, `budgets`
- **R4:** `qbo_connections`, `qbo_entity_map` (local_id ↔ QBO id — essential from the first line of QBO code; retrofitting it is agony)

---

## 5. Screens (R1)

**Onboarding:** Welcome · Sign in (Apple/email) · Business profile (logo, license #, address) · Trade selection *(pre-seeds the price book — plumbers get plumbing materials)* · Tax setup · Paywall

**Tabs: Home · Jobs · Clients · Money · More**

- **Home** — dashboard (outstanding, overdue, this month, quick actions) · **sync status & offline queue** *(non-negotiable: offline-first only works if users can see and trust it)*
- **Jobs** — list · detail (overview/estimates/invoices/photos/notes) · new job
- **Estimates** — list · editor · line item editor (cost → markup % → price) · price book picker · photo attach · preview · send sheet · signature capture · convert to invoice
- **Invoices** — list (unpaid/overdue/paid) · editor · preview · record payment · payment history · reminders
- **Clients** — list · detail (jobs, balance, history) · new/edit · import from Contacts
- **Price book** — list · item editor (cost, default markup, unit) · bulk import
- **More** — business profile · templates · tax rates · terms & defaults · numbering · subscription · notifications · export · help

### Out of scope for R1

Expenses · budgets · job profitability view · web dashboard · QuickBooks · card payments · team/crew members.

**Note on `memberships`:** the table ships in R1 even though team management does not. A solo operator is simply an org with one membership row. This is the tenancy model, not a team feature — RLS resolves `org_id` through it, so it cannot be deferred. What R1 omits is the *UI* to invite or manage additional members.

**Note on §3:** §3 describes the architecture of the whole product. R1 implements only the shared packages, the database, and the iOS app. The Next.js web stack is documented there because it constrains present decisions — it is why `packages/core` exists and why the web is read-only — but it is not built until R3.

---

## 6. Roadmap

| Release | Contents |
|---|---|
| **R1** | Estimate → invoice → paid. Offline-first, photos, price book, markups, PDF, send, record payment, clients, jobs. Ship to App Store with subscriptions. |
| **R2** | Expenses, receipts, **job profitability**. Stops being a me-too product. |
| **R3** | Web dashboard: financial position, spend by category, budgets, budget tips. |
| **R4** | QuickBooks sync. Build, then start Intuit's review clock. |
| **R5** | Stripe Connect card payments. |

---

## 7. Risks

**QuickBooks is a compliance project, not a feature.** Production access is gated behind Intuit's three-part review — technical, marketing, and security including **penetration testing**, with all critical/high/medium findings remediated before listing. Technical review averages ~20 days; realistic end-to-end is **6 weeks to 6+ months**, re-reviewed annually. Never put a date on it in marketing.

**QBO refresh tokens rotate every 24–26 hours.** Access tokens last 60 minutes, refresh tokens 100 days — but the refresh token *value* silently changes daily. Store the latest on every exchange or syncs die quietly, weeks later, one customer at a time.

**Invoice numbering is an unsolved offline problem.** Two devices offline both want #1043. Server-assignment breaks the client that already displayed the number. R1 targets solo operators (one device), so a client-side per-org counter is acceptable — **this breaks the moment crew/multi-device lands and must be revisited in R2.**

**Expense → QBO double-counting (R4).** Pushed expenses can duplicate against QBO's bank feed. Push as `Purchase` records shaped for QBO's bank-feed matching to absorb.

**Supabase Data API default change.** Since 2026-05-30 new projects don't expose `public` tables to the Data API by default; **on 2026-10-30 this is enforced on all existing projects.** Build against the new default now.

**Apple IAP.** External purchase links are not worth it: the Ninth Circuit ruled in Dec 2025 that Apple may charge commission on them, Apple asserts up to 27% plus reporting, and the framework is still in litigation with a Supreme Court petition pending. Standard IAP at 15% (Small Business Program, under $1M) is cheaper *and* stable.

**Physical-device preview requires a paid Apple Developer account ($99/yr).** Expo Go previews via QR for free, but only hosts modules bundled in its binary — PowerSync's native SQLite isn't one. Once offline lands, an EAS development build is required, and any build on a physical iPhone needs signing. Still no Mac needed.

---

## 8. Build workflow

Multi-agent. **Governing invariant: Sonnet writes only where Opus checks its work. Opus owns every phase nothing reviews.**

| Phase | Model | Agents | Parallel? | Why |
|---|---|---|---|---|
| **0 — Contracts** | Opus | `architect`, `database-reviewer` | **No** | Everything downstream inherits the schema; a wrong one means migrating live customer data. Two agents designing one schema produce two incompatible schemas. |
| **1 — Scaffold** | Sonnet | 3× `general-purpose` | Yes ×3 | Mechanical work against a finished spec, highest volume. Safe in parallel *only* because each owns a disjoint directory. |
| **2 — Security gate** | Opus | `security-reviewer` | No | Hard gate before real data. A cross-tenant leak ends the business, not the sprint. |
| **3 — Features** | Sonnet | domain agents + `tdd-guide` | Yes, by domain | Contract exists. Split by domain to avoid file conflicts. |
| **4 — Review** | Opus | `code-reviewer`, `typescript-reviewer`, `security-reviewer`, `performance-optimizer` | Yes ×4 | Independent lenses, read-only, no conflicts. |
| **5 — Fix & verify** | Opus | `build-error-resolver`, `e2e-runner` | No | **The only phase nothing reviews — it ships straight to the user.** |

### Phase 5 guardrail

Phase 5 agents **may not** weaken a type, add `any` or `@ts-ignore`, or add a retry/timeout to make a test pass. If a fix requires one, stop and report it as a finding.

Rationale: a type error's real cause is often a bad decision three files away, and the cheap fix silently undoes what Phase 4 just certified. On an offline-first app, an intermittent E2E failure is usually a genuine sync race — "add a longer `waitFor`" converts a production bug into a passing test.

### Cost note

Multi-agent is the expensive path; every agent starts cold. **This document is what makes the cheap agents cheap** — it is the brief each later agent reads instead of re-deriving the domain.
