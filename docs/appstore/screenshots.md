# App Store screenshots — capture spec

Apple requires screenshots for the 6.9"/6.7" iPhone display. Capture on an iPhone 15/16 Pro Max
simulator or device (1290×2796 px). iPad shots are NOT required — `supportsTablet` is false.

Required: 3–10 images. Seven are currently captured (`01-home` … `07-expenses`),
which clears Apple's minimum on its own. The list below is the target set:

1. **Home / health snapshot** — the dashboard health card + KPI tiles. Caption: "Know your profit on every job."
2. **New estimate** — the estimate builder with line items + live profit hero. Caption: "Build estimates on site."
3. **Estimate detail** — cost / profit / margin hero. Caption: "See margin as you quote."
4. **Invoice detail** — status banner + line items. Caption: "Invoice in a tap. Get paid."
5. **Invoice/receipt PDF** — the shared PDF preview. Caption: "Clean PDFs clients trust."
6. **Paywall** — FastTrack Pro screen. Caption: "Go Pro: unlimited + cloud sync."

## How to capture (no Mac required)

There is no iOS Simulator on the dev machine, and the owner's iPhone 12 is a 6.1"
display — it cannot produce the 6.9" set. Capture from the **Expo web build**
with Playwright instead, which renders the same React Native components and
writes true 1290×2796 PNGs:

1. Start the mobile dev server (`preview_start` the `mobile` launch config, port 8087).
2. Run a Playwright script with `viewport: 430×932` and `deviceScaleFactor: 3`.
   430×932 is the 6.9" logical size, so ×3 lands exactly on 1290×2796.
   Use `colorScheme: "dark"`, `isMobile: true`, `hasTouch: true`.
3. Click "Load demo data (Reyes Electric)" on onboarding first — a fresh browser
   context has an empty DB, and the seeded numbers are tuned to look real
   (see `seeds/demo.ts`; `demo.test.ts` pins the P&L so it stays that way).
4. Drive the app by clicking (`getByText(...).filter({ visible: true })`) rather
   than by URL, and wrap each screen in try/catch so one flaky step doesn't
   abandon the run.

Playwright 1.61 + Chromium are already installed via `apps/web`; import
`{ chromium }` from `@playwright/test` (the `playwright` package itself is not a
direct dependency). Output goes to `docs/appstore/screenshots/` (git-ignored).

**Do not** capture via a browser-pane screenshot tool: those cap the image at
~800px wide, and upscaling to 1290 leaves the text visibly soft.

### Two shots that cannot be taken this way

- **Paywall** — renders RevenueCat `packages`, which are empty on web, so it
  shows "Plans are loading…". Needs real products from runbook Step 3. Don't
  fake prices in: App Store screenshots showing prices you haven't configured
  are inaccurate metadata (guideline 2.3), and you'd reshoot anyway.
- **PDF preview** — `react-native-webview` is native-only; `preview.tsx` falls
  back to a text message on web by design. Needs a device or a separate harness
  that renders `buildDocumentHtml` output directly.
