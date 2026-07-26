# FastTrack Pro — price ladder

Single source of truth for what to enter in App Store Connect. Prices are **not**
in the codebase: the paywall reads them live from RevenueCat
(`product.priceString`), so changing a price is a store-side edit and needs no
app release. Only this doc and the RUNBOOK need to stay in sync.

## The ladder (US tier — App Store localises the rest)

| Plan | Product ID | Price | Per month | vs. weekly |
|------|-----------|-------|-----------|-----------|
| Weekly | `pro_weekly` | **$4.99 / week** | ~$21.63 | — |
| Monthly | `pro_monthly` | **$14.99 / month** | $14.99 | save 31% |
| Annual | `pro_annual` | **$99.99 / year** | ~$8.33 | save 61% |

Why this shape:

- **Weekly** is the impulse tier — a solo trade taking one job this week can pay
  $4.99, clear the free caps, send a clean PDF, and stop. It is deliberately the
  worst per-month rate; its job is to convert people who won't commit monthly.
- **Monthly** is the default working plan and must be an obvious step down from
  weekly's annualised rate (31%), or weekly cannibalises it.
- **Annual** carries the value story at ~$8.33/mo and is the badged, preselected
  plan on the paywall.

## Paywall behaviour (already built)

`src/subscriptions/plans.ts` derives all of this from the offering — no price
strings in the app:

- Rows are ordered weekly → monthly → annual.
- The cheapest per-month plan gets the **"Best value · save N%"** badge and is
  preselected. The percentage is computed against the priciest per-month plan,
  so it follows the store prices automatically.
- Non-monthly plans show their per-month equivalent (`$8.33/mo`) beneath the name.
- A saving under 5% is not badged.

Change the App Store prices and the paywall re-sorts, re-badges, and re-computes
the savings on next launch. If the ladder ever changes shape (e.g. annual stops
being the cheapest per-month plan), the badge moves on its own.

## Free tier

5 clients, 10 documents, FastTrack-footer PDFs, no cloud sync — see
`src/lib/gating.ts`.

The document cap is deliberately two per allowed client: a job usually becomes
an estimate and then an invoice, so the free plan covers one full cycle for
every client it allows. Keep that 1:2 ratio if the caps ever move again — the
earlier 3/5 pair ran out of documents before the third client could be
invoiced.

## Intro offers

Optional and configured per product in App Store Connect. If used, keep the trial
on **annual** only — a free trial on weekly is heavily abused and Apple's
cancellation window (24h) makes it near-free.
