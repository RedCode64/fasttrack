# Design ↔ Data Model Reconciliation

**Date:** 2026-07-15
**Inputs:** `FastTrack Mobile.dc.html`, `FastTrack Dashboard.dc.html` (Claude Design output)
**Amends:** `2026-07-15-fasttrack-design.md` §4 (data model), §5 (screens), §6 (roadmap)

---

## Verdict

The designs are **substantially compatible** with the spec, and the money model is confirmed exactly. But there are **three decisions the designs force** that the spec does not answer, and **one flagship feature with no definition at all**.

---

## Confirmed — no action needed

**The line item model is exactly right.** The mobile estimate builder renders `name · qty+unit · cost · markup% · price`, which is the spec's `estimate_lines` shape verbatim. Its four sample rows validate the shipped `priceFromCost` to the cent:

| Item | Cost | Markup | Design price | `priceFromCost` |
|---|---|---|---|---|
| 200A panel — Square D QO | $420 | +35% | $567 | 420 × 1.35 = **567** ✓ |
| SER 4/0 aluminum cable | $310 | +40% | $434 | 310 × 1.40 = **434** ✓ |
| AFCI breakers | $340 | +45% | $493 | 340 × 1.45 = **493** ✓ |
| Labor — service change | $1,040 | +55% | $1,612 | 1040 × 1.55 = **1612** ✓ |

**Margin is defined as profit ÷ revenue**, not markup-on-cost (`estimateSel`: `profit = amount - cost; margin = profit / amount`). That matches the spec's intent. Note the design divides without a zero guard — a $0 estimate yields `NaN`. `documentTotals` already guards this; the mobile mock does not.

**Statuses are a subset of the spec's enums.** Estimates: Draft, Sent, Viewed, Accepted. Invoices: Paid, Sent, Overdue, Partial. The spec's `declined`/`expired` are unused by the design but harmless. The dashboard adds `In progress` for **jobs**, which the spec's `jobs.status` must accommodate.

---

## Critical — decisions the designs force

### 1. The mobile design has no Jobs tab and no Clients tab

Mobile navigation is four tabs: **Home · Estimates · Invoices · Expenses**. The spec (§5) specifies five: Home · Jobs · Clients · Money · More.

The design treats estimates and invoices as top-level objects — exactly like the competitors — with "job" surviving only as a *label* (`Novak — Panel upgrade`) on expenses and as `client + title` on estimates. **There is no way to create or browse a job.**

The web dashboard, by contrast, is fully job-aware: its nav has a `JOBS & CLIENTS` group containing Job Profitability, Jobs, and Clients.

**So the two designs disagree with each other**, and the mobile one disagrees with the spec's central architectural decision.

This does **not** necessarily kill the job-first spine. A job-first *schema* with an estimate-first *mobile IA* is coherent and probably better UX — tradespeople think "I'm quoting the Novak panel job," not "I'm creating a Job record." But it forces a question the spec never answers:

> **How does a job come into existence?**

Options: implicitly created when an estimate is drafted (job = client + title); explicitly via a Jobs tab the design omits; or lazily, when a second document is attached to the same client+title.

**This is the highest-consequence open item.** Job is the spine of the entire data model and the thing R2's profitability depends on. If jobs are implicit, the creation rule *is* the architecture.

### 2. The health score has no definition. It is a hardcoded 72.

Both designs display it. The dashboard's source is unambiguous:

```js
const SCORE = 72, A0 = 135, SPAN = 270;
const scoreColor = (v) => v >= 70 ? green : v >= 55 ? amber : red;
```

`72` is a literal. The mobile screen shows the same 72 with the labels *"Good — steady"* and *"Profitable & collecting. Watch overdue + materials."* — also literals.

This was flagged as undefined when the design prompt was written, and it is still undefined. It is the flagship feature of the dashboard, it drives an animated gauge (135° start, 270° sweep, cubic ease-out, 1150ms), and **nothing specifies what it measures.**

Known from the design: it is 0–100; thresholds are ≥70 good, ≥55 warning, <55 bad; and it emits a short human explanation naming its worst contributors.

Needed: the inputs, their weights, and the window. Candidate inputs the schema can already produce — margin vs. target, receivables aging, budget adherence, cash collected vs. spend. **This must be specified before the dashboard plan, and it is a product decision, not a technical one.**

### 3. The invoice presentation contradicts the line-item model

The mobile invoice detail itemizes:

```
Materials (panel, wire, breakers)   $6,240
Labor — 16 hrs                      $4,180
Permit — 200A service                 $210
Markup & overhead                   $1,770
                            Total  $12,400
```

**This shows the customer your cost lines and your markup as a separate line.** The spec's model does the opposite: `unit_price = unit_cost × (1 + markup)`, so markup is embedded per line and the customer sees only prices — cost never leaves the business.

These are incompatible presentations of the same document, and it is a commercial decision, not a formatting one: a separate "markup" line is an invitation to negotiate it away. Most contractors deliberately do not expose it.

(The design's mock data is also internally inconsistent here — those lines sum to $12,400, but the estimate screen states cost $8,180 for the same job, which would imply $4,220 of markup, not $1,770. Mock artifact, not a real defect, but it means the invoice breakdown was not derived from the line model.)

---

## Schema gaps — additive, low risk

### 4. `is_billable` is a distinct concept from `job_id`

The new-expense screen has **both** a Job field (`Novak — Panel upgrade`) **and** a separate `Billable to job` toggle.

The spec conflates these: `expenses.job_id` nullable, with null meaning overhead. But they answer different questions:

- **`job_id`** — whose profitability does this cost reduce? (internal)
- **`is_billable`** — should this be passed through onto the client's invoice? (external)

A permit is billable. A tank of fuel driven to that job is attributable but usually not billable. The spec cannot express that distinction. **Add `is_billable boolean` to `expenses`.**

### 5. `expenses` needs `vendor`

Prominent throughout: City Electric Supply, Shell, Home Depot, Graybar, County Permits, Staples. The spec's R2 sketch omits it.

### 6. Receipt OCR is core, not a nice-to-have

The capture screen shows *"Receipt scanned · Retake"* with vendor, amount, and line items pre-extracted. The spec lists a "Receipt scanner" screen but models no fields for it. Needs: image reference, extracted values, and a marker for whether a field was OCR-derived or user-corrected — you cannot trust an OCR'd total silently.

### 7. `payments.method` is missing `bank_transfer`

Design shows *"Bank transfer · Jul 14"*. The spec's enum is `check | cash | zelle | card_other`. Add it.

### 8. Period comparison needs a reporting window

Home shows `▲ 6.2%` on revenue, `▲ 3.1%` on spend, plus "This week $1,806" against "July spend $19,100". The rows support this; no schema change is needed. But prior-period deltas and week/month windows are a reporting concern the spec never mentions.

---

## Scope conflicts with the roadmap

### 9. Estimate-level margin belongs in R1, not R2

The estimate detail leads with **Your cost · Profit · Margin**. Spec §5 lists "job profitability view" as out of scope for R1.

The data is already free — cost and markup are on every line, and `documentTotals` plus `priceFromCost` already compute it. **Recommend moving estimate-level margin into R1** and keeping *job-level* profitability (which needs expenses) in R2. It is the product's whole differentiator and it costs nearly nothing to surface at the point of quoting, which is exactly where it changes behaviour.

### 10. The design is the R2 product, not the R1 product

Expenses have a dedicated tab, list, and capture flow throughout the mobile design. Spec §5 puts expenses in R2 entirely.

Not a defect — but **the R1 app will look materially thinner than this design**, missing an entire tab. Worth knowing before it feels like a regression.

---

## Recommended decisions

| # | Decision needed | Owner | Blocks |
|---|---|---|---|
| 1 | How do jobs get created, given no Jobs tab? | Product | Database plan — this is the spine |
| 2 | What does the health score actually measure? | Product | Dashboard plan (R3) |
| 3 | Does the client-facing invoice expose cost + markup separately, or prices only? | Commercial | PDF template, R1 |
| 4 | Add `is_billable`, `vendor`, OCR fields to `expenses`; add `bank_transfer` to payment methods | Technical | Database plan (additive, low risk) |
| 5 | Move estimate-level margin into R1 | Scope | R1 plan |

Items 1 and 3 must be settled **before** the database plan. Item 2 can wait for R3 but should not be forgotten — it is the dashboard's headline feature and currently it is the number 72.
