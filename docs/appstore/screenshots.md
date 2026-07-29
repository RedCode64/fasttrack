# App Store screenshots — capture spec

Apple requires 3–10 iPhone screenshots. iPad shots are NOT required — `supportsTablet`
is false.

Run `node docs/appstore/capture-screenshots.mjs` with the Expo dev server up. It
writes 9 screens × 3 device sizes into `docs/appstore/screenshots/<slot>/`
(git-ignored).

## Device sizes

| Directory | Pixels | Fills the ASC slot | Modelled on |
|---|---|---|---|
| `6.9-inch-1320x2868` | 1320×2868 | iPhone 6.9" (**required**) | iPhone 17 / 16 Pro Max |
| `6.9-inch-1290x2796` | 1290×2796 | iPhone 6.9" (alternate accepted size) | iPhone 16 Plus / 15 Pro Max |
| `6.5-inch-1242x2688` | 1242×2688 | iPhone 6.5" (optional) | iPhone 11 Pro Max |

Uploading **one** 6.9" set satisfies Apple — ASC down-scales it for smaller
devices. The other two sets exist so the smaller slots can be filled explicitly
rather than letting Apple crop, and so layout reflow is verified at each width.

## The set, with captions

| File | Screen | Caption |
|---|---|---|
| `01-home` | Health score + revenue/profit/spend/outstanding tiles | Know your profit on every job. |
| `02-estimates` | Estimate pipeline with status pills | Your whole pipeline, one screen. |
| `03-estimate-detail` | Cost / profit / margin hero + line items | See margin as you quote. |
| `04-line-margin` | Per-line cost & markup editor | Price every line, not just the total. |
| `05-invoices` | Invoice list, filterable by status | Know exactly who owes you. |
| `06-invoice-detail` | Paid-in-full banner + payments ledger | Invoice in a tap. Get paid. |
| `07-invoice-overdue` | Overdue banner + Send reminder | Chase overdue money automatically. |
| `08-expenses` | Month spend + categorised expenses | Every cost, tied to the job. |
| `09-get-paid-export` | Payment link + QuickBooks/Xero CSV export | Get paid online. Export for your books. |

## How the capture works (no Mac required)

There is no iOS Simulator on the dev machine and the owner's iPhone 12 is a 6.1"
display, so it cannot produce the 6.9" set. The script renders the **Expo web
build** — the same React Native components through react-native-web — with
Playwright at `deviceScaleFactor: 3`, which lands on exact App Store pixel sizes.

1. Start the mobile dev server (`preview_start` the `mobile` launch config, port 8087).
2. `node docs/appstore/capture-screenshots.mjs`

Playwright 1.61 + Chromium come in via `apps/web`; the script resolves
`@playwright/test` from there, so it runs from any cwd.

### Gotchas the script already handles

- **Seed the demo data first.** A fresh browser context has an empty DB. The
  script clicks "Load demo data (Reyes Electric)" on onboarding; those numbers
  are tuned to look real and are pinned by `demo.test.ts`.
- **`.last()` when clicking a card.** react-navigation keeps inactive tab screens
  mounted *and laid out*, so Playwright reports the hidden Home screen's copy of
  a client name as visible, then times out clicking it underneath the active
  screen. Screens mount in visit order, so the active one is always last.
- **Every step is isolated** in try/catch behind a fresh `goto`, so one flaky
  step can't abandon the run. The summary line reports per-slot pass counts.

**Do not** capture via a browser-pane screenshot tool: it caps the image around
800px wide, and upscaling to 1290 leaves text visibly soft.

### Screens deliberately excluded

- **New estimate / new expense forms** — the demo seed exceeds the 5-client free
  cap, so both render an empty form under a "you've used all 5 free clients"
  notice. Bad marketing, and it reads like a hard paywall.
- **Cloud sync** — a signed-out email/password form with a red "Delete cloud
  account" link. Real screen, weak shopfront.
- **Paywall** — renders RevenueCat `packages`, which are empty on web. Needs real
  products. Don't fake prices in: showing prices you haven't configured is
  inaccurate metadata (guideline 2.3), and you'd reshoot anyway.
  (`paywall-review-mock.png` in this directory is the 1290×2796 *subscription
  review screenshot* for ASC — a different field, not an App Store screenshot.)
- **PDF preview** — `react-native-webview` is native-only; `preview.tsx` falls
  back to a text message on web by design. Needs a device, or a harness that
  renders `buildDocumentHtml` output directly.
