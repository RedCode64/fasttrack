# Plan 3 — Web Dashboard Implementation Plan

> Executed inline (user-selected mode). Source of visual truth: `FastTrack Dashboard.dc.html` (repo-root zip). Data: live Supabase `sxmazpcygbkyclmclexw` under RLS. Read-only product surface (spec §3): the dashboard reviews numbers; documents are created on mobile.

**Goal:** `apps/web` — Next.js App Router port of the 12-screen dashboard design, querying Supabase under RLS with `@fasttrack/core` math and `@fasttrack/schema` parsing, plus a demo dataset computed by the same engine.

**Stack:** Next.js 15 (App Router, RSC-first) · React 19 · TypeScript · `@supabase/ssr` (cookie sessions) · CSS custom properties + CSS Modules (NO Tailwind — faithful port of the design's bespoke styling) · `next/font/google` for Plus Jakarta Sans + Space Grotesk (self-hosted at build; no runtime font requests) · hand-rolled SVG charts exactly like the design (gauge/donut/bars are design-system pieces, not a chart lib).

**Design tokens (from the HTML):** bg `#eceeea` · ink `#1c2622` · muted `#707b75` / `#8a938d` / `#a3aca6` · surface `#fff` · surface-2 `#f4f6f2` · hover `#f3f6f2` · border `#e7ebe6` · green `#1c7c4e` (dark `#0f5233`) · red `#cf4b4b` · amber `#b9822a` · navy avatar `#17211c`. Status pills: Paid `#e9f4ec/#1c7c4e`, Sent `#e6f0f4/#2b6f86`, Viewed `#eaf0f6/#3a6ea5`, Partial `#f6eeda/#b9822a`, Draft `#eef0ec/#707b75`, Overdue `#fbecec/#cf4b4b`, In progress `#eaf0f6/#3a6ea5`. Shell: 252px white sidebar, 66px header, content `max-width:1200px`, `fadeUp .4s`. Gauge: start 135°, sweep 270°, r=80 @ 200×200, 1150ms cubic ease-out, bands ≥70 green / ≥55 amber / <55 red.

## File structure

```
apps/web/
  package.json  next.config.ts  tsconfig.json  .env.local(gitignored)  .env.example
  src/
    middleware.ts                  session refresh + route guards (/login public; no-org → /onboarding)
    lib/supabase/server.ts         createServerClient (RSC + route handlers)
    lib/supabase/client.ts         createBrowserClient (auth forms only)
    lib/queries.ts                 org-scoped selects, zod-parsed at the boundary (schema pkg)
    lib/rollups.ts                 pure derivations: HealthInputs(90d), monthly series, aging buckets,
                                   spend by category vs budgets, job profitability, rule-based tips
    lib/format.ts                  money/date/pct formatters (cents → $, bps → %)
    app/layout.tsx  app/globals.css(tokens)  app/login/page.tsx  app/onboarding/page.tsx
    app/(dash)/layout.tsx          sidebar + header shell (server; user/org from session)
    app/(dash)/page.tsx            1 Financial Position — health gauge + KPI row + drivers
    app/(dash)/spend/page.tsx      2 Spend by Category — donut + category table
    app/(dash)/budgets/page.tsx    3 Budgets — per-category bars, over/under states
    app/(dash)/tips/page.tsx       4 Optimization Tips — rule-based list (badge count = open tips)
    app/(dash)/revenue/page.tsx    5 Revenue & Receivables — monthly bars + aging buckets
    app/(dash)/profit/page.tsx     6 Job Profitability — per-job revenue/cost/margin table
    app/(dash)/jobs/page.tsx       7 Jobs · 8 clients/page.tsx · 9 invoices/page.tsx · 10 expenses/page.tsx
    app/(dash)/reports/page.tsx    11 Reports & Export (CSV download of core tables)
    app/(dash)/settings/page.tsx   12 Settings — org profile, tax, target margin (the one write surface)
    components/                    StatusPill, HealthGauge, StatCard, DataTable, Donut, Bars, NavLink, EmptyState
  scripts/generate-demo-sql.mts    demo dataset for org "Reyes Electric": totals via documentTotals,
                                   prices via priceFromCost — every rendered number reconciles to the engine
```

## Execution order (commit per group)

1. **Scaffold** — configs, tokens/globals, fonts, supabase clients, middleware, login, onboarding (org insert → membership insert → rpc seed_price_book + seed_expense_categories). Verify: `pnpm --filter web build`.
2. **Shell** — sidebar (5 nav groups, badges), header (search chrome, month chip, avatar), read-only card. Verify in browser pane.
3. **Data layer** — queries + rollups + format; unit tests for rollups math (vitest) since they feed the gauge.
4. **Screens 1–6** (analytic): Financial Position, Spend, Budgets, Tips, Revenue, Profitability.
5. **Screens 7–12** (records): Jobs, Clients, Invoices, Expenses, Reports, Settings.
6. **Demo data** — script → SQL → `execute_sql` (auth demo user `demo@fasttrack.app`, org, 8 clients, 12 jobs, 10 estimates, 9 invoices, payments, ~40 July-2026 expenses across the design's vendors, budgets). Screenshot key screens at 1360×900.

## Acceptance

- Login → onboarding → dashboard flow works against the live project; RLS confirmed (user sees only own org).
- Health gauge renders `healthScore` output (not 72) with matching bands + summary text.
- Estimate/invoice numbers on screen equal `documentTotals`/`documentProfit` outputs for the same rows (spot-check in rollup tests).
- All 12 screens render with demo data; no console errors; `pnpm --filter web build` clean.
- No secrets in source: URL + publishable key via env only.
