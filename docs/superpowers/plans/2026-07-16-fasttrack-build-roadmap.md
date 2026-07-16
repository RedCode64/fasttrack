# FastTrack Full Build — Roadmap

**Date:** 2026-07-16
**Amends:** `2026-07-15-fasttrack-design.md`, `2026-07-15-design-reconciliation.md`
**Status:** Approved scope, execution in progress

---

## Decisions locked today

| # | Decision | Consequence |
|---|---|---|
| A | **Full designs scope** — build what the Claude Design files show, not strict R1 | Expenses, budgets, and the 12-screen web dashboard are IN. QBO (R4), card processing (R5), automated receipt OCR, IAP paywall, and Sign in with Apple are OUT (schema stays ready for OCR; email auth first). |
| B | **Health score v1 is defined** | `score = 0.4·margin + 0.3·receivables + 0.3·collection`, each component 0–100. Margin: realized margin (trailing 90d) vs org target (default 30.00% = 3000 bps). Receivables: share of outstanding balance not overdue. Collection: cash collected ÷ invoiced (90d), clamped. Bands per design: ≥70 good, ≥55 watch, <55 risk. Lives in `packages/core` with tests; the gauge stops being a hardcoded 72. |
| C | **Supabase project created via MCP** on the user's account, free tier | One Postgres for both apps. RLS on `org_id` through `memberships`. Cost confirmed at $0 before creation. |
| D | **Expo Go first** for mobile preview | Data layer written against a thin DB interface; `expo-sqlite` driver now (fully offline on device), PowerSync driver later via EAS dev build without a rewrite. |

## Plan sequence

Each plan produces working, testable software on its own. Later plans are written when their inputs exist, never before.

| Plan | Doc | Scope | Depends on |
|---|---|---|---|
| **1 — Shared foundations** | `2026-07-16-plan-1-shared-foundations.md` | `packages/core`: `documentProfit` (estimate-level margin, reconciliation item 9) + `healthScore` (decision B). `packages/schema`: Zod row schemas for every entity — the single source of column names and types. | nothing |
| **2 — Database** | written after Plan 1 | Supabase project, migrations for all tables/enums/indexes, RLS policies, storage buckets, trade price-book seeds, demo data. Verify against the 2026-10-30 Data API default via Supabase docs before writing. Security gate: `get_advisors` + security review. | Plan 1 (column names locked) |
| **3 — Web dashboard** | written after Plan 2 | Next.js App Router, the 12 screens from `FastTrack Dashboard.dc.html`: Financial Position (live health gauge), Spend, Budgets, Tips, Revenue & Receivables, Job Profitability, Jobs, Clients, Invoices, Expenses, Reports, Settings. Read-only queries under RLS, email auth. | Plan 2 (live DB + seeds) |
| **4 — Mobile app** | written after Plan 2 | Expo/RN per `FastTrack Mobile.dc.html`: Home · Estimates · Invoices · Expenses tabs. Estimate builder with live cost/profit/margin, price book picker, convert-to-invoice, record payment, receipt capture, `expo-print` PDF (prices only, grouped by kind — decision 8), jobs created implicitly (decision 7). Local SQLite behind DB interface (decision D). | Plan 2 |
| **5 — Integration & E2E** | written after Plans 3–4 | Playwright E2E on web flows, mobile flow verification, sync push (mobile → Supabase when online), polish pass, `superpowers:finishing-a-development-branch`. | Plans 3, 4 |

## Governance (spec §8)

Contracts and schema (Plan 1–2 design) and all security/review gates run at highest scrutiny; scaffold and feature volume can be delegated per task via `superpowers:subagent-driven-development`. Phase-5 guardrail applies throughout: no weakening types, no `any`/`@ts-ignore`, no retry/timeout to green a test.

## Standing risks carried forward

- Invoice numbering is a client-side per-org counter — acceptable solo, breaks on multi-device (spec §7); revisit with PowerSync.
- Supabase Data API public-schema default (2026-10-30 enforcement) — Plan 2 must build against the new default.
- Expo Go cannot load PowerSync's native module — decision D is the mitigation.
