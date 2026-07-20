# App Store screenshots — capture spec

Apple requires screenshots for the 6.9"/6.7" iPhone display. Capture on an iPhone 15/16 Pro Max
simulator or device (1290×2796 px). iPad shots are NOT required — `supportsTablet` is false.

Required: 3–10 images. Capture these 6, portrait, in this order:

1. **Home / health snapshot** — the dashboard health card + KPI tiles. Caption: "Know your profit on every job."
2. **New estimate** — the estimate builder with line items + live profit hero. Caption: "Build estimates on site."
3. **Estimate detail** — cost / profit / margin hero. Caption: "See margin as you quote."
4. **Invoice detail** — status banner + line items. Caption: "Invoice in a tap. Get paid."
5. **Invoice/receipt PDF** — the shared PDF preview. Caption: "Clean PDFs clients trust."
6. **Paywall** — FastTrack Pro screen. Caption: "Go Pro: unlimited + cloud sync."

How to capture (after an EAS build or `expo run:ios` on a simulator):
- Simulator → File → Save Screen (⌘S) at the 6.9" size, or drag to resize the window then ⌘S.
- Put files in `docs/appstore/screenshots/` named `01-home.png` … `06-paywall.png` (folder is git-ignored if large; keep locally for upload).

Use the seeded demo data (the app seeds demo clients/estimates) so screenshots show realistic content.
