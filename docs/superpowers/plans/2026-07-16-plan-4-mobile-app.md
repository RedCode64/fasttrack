# Plan 4 — Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline execution is the user's standing choice). Source of visual truth: `FastTrack Mobile.dc.html` (repo-root zip, extracted to session scratchpad). Groups are checkboxes; commit per group.

**Goal:** `apps/mobile` — Expo app porting the 4-tab mobile design (Home · Estimates · Invoices · Expenses), fully offline on local SQLite behind a thin driver interface (decision D), with every money figure computed by `@fasttrack/core`.

**Architecture:** expo-router screens over a repository layer (`src/db/repos`) that is the only writer; repos run on a `SqlDriver` interface with two implementations — `expo-sqlite` on device, `sql.js` (wasm, no native build) for vitest on Node and the Expo web preview. Ids and clock are injected (`DbCtx`), so repo tests are deterministic. Local DDL mirrors `packages/schema` column names exactly; every repo read is parsed by the row schemas at the boundary, so branded `Cents`/`BasisPoints` feed core math directly. **No network, no auth in this plan** — sync push and the Supabase link are Plan 5 (roadmap).

**Tech stack:** Expo (latest SDK via `create-expo-app`, Expo Go-compatible only) · expo-router tabs · TypeScript strict · expo-sqlite · sql.js (dev/web) · expo-print + expo-sharing (PDF, decision 8) · expo-image-picker + expo-file-system (receipt capture; OCR stays OUT per decision A — photo attach only, fields manual) · react-native-svg (health ring, tab icons) · @expo-google-fonts Plus Jakarta Sans + Space Grotesk · @fasttrack/core, @fasttrack/schema · vitest.

**Design tokens (from the mobile HTML):** screen bg `#f4f6f2` · page `#e7ebe4` · ink `#1c2622` · muted `#8a938d`/`#a3aca6`/`#b3bab4`/`#5c665f` · surface `#fff` · borders `#eceeea`/`#e7ebe6`/`#d9ded6` · green `#1c7c4e` (dark `#0f5233`, mint `#8ff0b6`, wash `#e9f4ec`) · red `#cf4b4b` · amber `#b9822a` · navy chip `#17211c` · hero card `radial-gradient(140% 130% at 15% 10%, #1a6c44, #0f5233)` (RN: approximate with react-native-svg radial gradient fill). Status pills identical to web: Paid/Accepted `#e9f4ec/#1c7c4e`, Sent `#eaf0f6/#3a6ea5`, Viewed `#e6f0f4/#2b6f86`, Partial `#f6eeda/#b9822a`, Draft `#eef0ec/#707b75`, Overdue `#fbecec/#cf4b4b`. Tab bar: white blur, active green w=700, inactive `#9aa39c`. Icons: port the design's `ic()` SVG paths verbatim.

## Domain rules locked here

- **Numbering (spec §7 risk accepted):** per-org counter inside the insert transaction, `COALESCE(MAX(number), 1000) + 1` — first document is 1001. Display `EST-{n}` / `INV-{n}`.
- **Implicit job (decision 7):** `estimateRepo.createDraft` takes client (existing or new) + job title → inserts job (`status 'quoted'`) then the draft estimate against it. No Jobs tab on mobile.
- **Line snapshotting:** price-book pick copies `unit_cost_cents` + `default_markup_pct` onto the line and computes `unit_price_cents = priceFromCost(cost, markup)`; custom lines take manual cost/markup with live price preview. After every line write, recompute + persist `documentTotals(lines, discount=0, org.tax_config.rate_bps)`. Discount UI is not in the mobile design — always 0 here, column stays.
- **Statuses:** estimate `draft →(send)→ sent →(mark)→ accepted | declined`; send = generate PDF → share sheet → set `sent` + `issued_at`. Convert (accepted estimates): tx copies active lines with new ids, sets `converted_from_estimate_id`, invoice starts `draft`; invoice send sets `sent`, `issued_at = now`, `due_at = now + 14d`, marks the job `in_progress`. `recordPayment` inserts payment, recomputes `balance_cents = total − Σ payments`, status `paid` if balance ≤ 0 else `partial`. **Overdue is derived at read time** (`status in sent/viewed/partial ∧ due_at < now ∧ balance > 0`) — never written, so sync stays clean.
- **Soft deletes only** (spec §4): repos set `deleted_at`; every query filters `deleted_at IS NULL`.
- **KPI/health definitions mirror `apps/web/src/lib/rollups.ts`** (read it at implementation time; same numbers on both surfaces): health window 90d, `HealthInputs` fed to `healthScore` — the Home gauge is never hardcoded.
- **PDF (decision 8):** `buildDocumentHtml(...)` pure function — lines grouped by `kind` (Materials/Labor/Other), each row description · qty × unit · unit **price** · line total; subtotal/tax/total block; org header + client block + notes/terms. **No cost, no markup anywhere in the HTML.** Unit-tested for both inclusions and exclusions.

## File structure

```
apps/mobile/
  package.json  app.json  tsconfig.json  metro.config.js  vitest.config.ts
  app/
    _layout.tsx                    fonts + DbProvider + onboarding gate (Stack)
    onboarding.tsx                 first-run org setup: name, trade picker, target margin
                                   (default 3000 bps), tax rate; __DEV__-only "Load demo data"
    (tabs)/_layout.tsx             tab bar: Home · Estimates · Invoices · Expenses (design icons)
    (tabs)/index.tsx               HOME — greeting, HealthRing (live healthScore), 2×2 KPI grid
                                   w/ MoM deltas, quick actions, recent activity
    (tabs)/estimates.tsx           pipeline list: client, title, pill, date, amount; + button
    (tabs)/invoices.tsx            list + filter chips All/Overdue/Sent/Paid (overdue derived)
    (tabs)/expenses.tsx            month + week spend card, expense rows w/ receipt thumbs
    estimate/new.tsx               client (pick or create) + job title → createDraft → builder
    estimate/[id]/index.tsx        builder/detail: green hero (total · cost · profit · margin,
                                   live documentProfit), line cards w/ markup chips, add-line,
                                   Preview PDF / Send / Accept / Decline / Convert CTAs
    estimate/[id]/line.tsx         modal: price-book picker (grouped material|labor, search)
                                   OR custom entry; qty/unit/cost/markup% → live price preview
    invoice/[id].tsx               banner by status (paid/overdue/partial/sent variants), billed-to,
                                   lines, total, actions: Send · Record payment (sheet) · View PDF
    expense/new.tsx + expense/[id].tsx   capture form: photo, amount, vendor, category, job,
                                   billable toggle (edit reuses form)
  src/
    theme.ts                       tokens above
    lib/format.ts                  money(cents), pct(bps), shortDate, monthLabel
    lib/pdf.ts                     buildDocumentHtml (pure) — decision 8
    lib/printPdf.ts                thin expo-print/expo-sharing wrapper (untested)
    db/driver.ts                   SqlDriver { exec(sql, params?): Promise<Row[]> }, DbCtx
                                   { driver, newId(): string, now(): string /* ISO */ }
    db/expoDriver.ts               expo-sqlite impl (only file importing expo-sqlite)
    db/sqlJsDriver.ts              sql.js impl (tests + web)
    db/schema.ts                   DDL — tables: organizations, clients, jobs, price_book_items,
                                   estimates, estimate_lines, invoices, invoice_lines, payments,
                                   expense_categories, expenses. Columns = packages/schema names;
                                   TEXT uuid/timestamps/dates/json, INTEGER cents/bps/number/bool,
                                   REAL quantity. No budgets/photos tables (web-only surfaces).
    db/migrations.ts               PRAGMA user_version runner
    db/seeds/priceBookTemplates.ts 31 rows ported verbatim from plan-2 doc migration 6
    db/seeds/categories.ts         the 8 default categories (names from plan-2 doc)
    db/seeds/demo.ts               __DEV__ dataset matching the design mock (Novak, Okafor Café,
                                   Hartley, Delgado, Whitfield, Ramos…) — all money engine-computed
    db/repos/orgRepo.ts            createOrg (org + trade price book + categories), getOrg, boundary
                                   row-parse helpers (SQLite ints/JSON → schema.parse)
    db/repos/clientRepo.ts         list/create/get
    db/repos/estimateRepo.ts       createDraft (implicit job), lines CRUD, totals recompute,
                                   profit(), send/accept/decline, list/get
    db/repos/invoiceRepo.ts        convertFromEstimate, send, recordPayment, list(filter)/get
    db/repos/expenseRepo.ts        categories, create/update, list, month/week totals
    db/repos/kpis.ts               monthKpis (revenue/spend/profit+deltas, outstanding+overdue),
                                   healthInputs(90d) → healthScore, activity(limit)
    db/DbProvider.tsx              opens platform driver, runs migrations, exposes repos + version
                                   bump for refetch; useQuery(fn, deps) + useFocusEffect refetch
    components/HealthRing.tsx      svg ring, bands ≥70/≥55, animated sweep
    components/StatCard.tsx  components/ActivityRow.tsx  components/EmptyState.tsx
    components/ui/…                Pill, Card, MoneyText, SectionLabel, PrimaryButton, GhostButton,
                                   FormRow, Toggle, Icon (design ic() paths)
  (tests colocated `*.test.ts` beside repos/lib — house style)
```

**Testability rule:** `src/db/**` (except `expoDriver.ts`, `DbProvider.tsx`) and `src/lib/**` (except `printPdf.ts`) import nothing from react-native/expo. Vitest runs them on Node over sql.js.

## Execution order (commit per group)

- [ ] 1. **Scaffold** — `create-expo-app` into `apps/mobile`, trim template, add deps (expo-sqlite, expo-print, expo-sharing, expo-image-picker, expo-file-system, react-native-svg, expo-crypto, fonts; dev: vitest, sql.js), theme.ts, vitest config, root `pnpm install`. Verify: `pnpm --filter mobile exec tsc --noEmit`, placeholder vitest green, `pnpm --filter mobile exec expo export --platform web` bundles. Fallback if Metro chokes on pnpm symlinks: root `.npmrc` `node-linker=hoisted` (re-verify web app still builds).
- [ ] 2. **DB core** — driver interface, sqlJsDriver, schema DDL, migration runner, template/category seeds (port from plan-2 doc §migration 6). Tests: migration idempotence, seed counts per trade, boundary parse of a written row (`timestampField` accepts `now()` output — catches format drift).
- [ ] 3. **Repos (TDD, the money surface)** — org/client/estimate/invoice/expense/kpis per domain rules above. Tests per op: numbering starts 1001 + sequential per org; implicit job created `quoted`; price-book line snapshot equals `priceFromCost`; totals persist = `documentTotals`; convert copies lines + backlink + totals, send sets dates + job `in_progress`; payment transitions partial→paid, balance signed; overdue derived not written; soft-deleted rows vanish everywhere; monthKpis + healthInputs feed `healthScore` (mirror web rollups.ts definitions); expo web/native drivers untouched by tests.
- [ ] 4. **Shell + onboarding + Home** — `_layout` (fonts, DbProvider, gate), onboarding (+ dev demo seed), tabs with design icons, Home screen fully live (ring, KPIs, actions, activity). Verify in Expo web preview (Browser pane) with demo data; empty-state pass without it.
- [ ] 5. **Estimates + PDF** — list, new flow, builder with live `documentProfit` hero, line modal + price-book picker, `pdf.ts` + tests (prices only, grouped by kind — decision 8), Preview/Send wiring via printPdf.
- [ ] 6. **Invoices** — list + chips + derived overdue, detail banner variants, send, record-payment sheet, View PDF, Convert CTA on accepted estimates.
- [ ] 7. **Expenses** — list + month/week card, capture form with photo copy into `documentDirectory/receipts/`, category/job pickers, billable toggle, edit.
- [ ] 8. **Verify + record** — full root `pnpm test` + `pnpm typecheck`, `expo export` both platforms, Browser-pane walkthrough + screenshots of all screens vs design, execution record appended here, memory updated, final commit.

## Acceptance

- Onboarding → tabs works with **zero network**; org row + trade-filtered price book + 8 categories exist locally.
- Builder hero equals `documentProfit` and stored totals equal `documentTotals` for the same lines (asserted in repo tests, visible live in UI).
- Estimate PDF + invoice PDF contain prices/totals only, grouped Materials/Labor/Other; tests assert cost & markup strings absent (decision 8).
- Convert → invoice: lines copied w/ new ids, `converted_from_estimate_id` set, numbering sequential, estimate `accepted`.
- Payments: partial then final payment drive `partial → paid`, balance hits 0; overdue shows derived on list + detail without a DB write.
- Home gauge = `healthScore` over local 90d inputs (band + summary rendered), never the hardcoded 72; KPI cards from SQL aggregates with MoM deltas.
- Receipt capture stores a local file path in `receipt_storage_path`; expense rows render the thumbnail.
- Every repo read passes its `@fasttrack/schema` row schema; no `any`/`@ts-ignore`; soft deletes everywhere.
- Data-layer + lib coverage ≥ 80%; `pnpm --filter mobile test` and root `typecheck` green; `expo export` clean for web; app boots in Expo Go (user QR-scans; Browser-pane web preview is the in-session proxy).
- No secrets, no network calls introduced.

## Risks

- **pnpm symlinks × Metro on Windows** — mitigation staged in group 1 (hoisted fallback).
- **sql.js wasm on Expo web** — if Metro wasm bundling fights back, web preview may degrade; device (Expo Go) + Node tests remain the verification floor. Native path uses expo-sqlite regardless.
- **Expo SDK drift** — create-expo-app resolves the current matrix; user's Expo Go must be current. No native modules outside Expo Go's set (decision D holds; PowerSync deferred).
- **Template duplication** — price-book templates now live in Postgres *and* `seeds/priceBookTemplates.ts`; acceptable until Plan 5 sync, noted for reconciliation there.
