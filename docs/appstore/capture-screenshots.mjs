// Captures App Store screenshots from the Expo *web* build with Playwright.
//
// There is no iOS Simulator on the dev machine, so this renders the same React
// Native components through react-native-web at true App Store pixel sizes.
// Start the Expo dev server first (port 8087), then:
//
//   node docs/appstore/capture-screenshots.mjs
//
// Output: docs/appstore/screenshots/<slot>/NN-name.png (git-ignored).
// See screenshots.md for why the browser-pane screenshot tool is not used.

import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// Playwright is a dependency of `apps/web`, not of the repo root, so resolve it
// from there rather than relying on this script's own location or the cwd.
const REPO_ROOT = join(HERE, "..", "..");
const { chromium } = createRequire(join(REPO_ROOT, "apps", "web", "package.json"))(
  "@playwright/test",
);
const OUT_ROOT = join(HERE, "screenshots");
const APP_URL = process.env.APP_URL ?? "http://localhost:8087";

// App Store Connect iPhone slots. `width`/`height` are CSS px; ×3 lands exactly
// on the pixel dimensions ASC accepts for that slot.
const DEVICES = [
  { slot: "6.9-inch-1320x2868", width: 440, height: 956, note: "iPhone 17/16 Pro Max" },
  { slot: "6.9-inch-1290x2796", width: 430, height: 932, note: "iPhone 16 Plus / 15 Pro Max" },
  { slot: "6.5-inch-1242x2688", width: 414, height: 896, note: "iPhone 11 Pro Max (optional slot)" },
];

const SETTLE_MS = 900;

/** Click the first visible node carrying this text, and wait for the nav to paint. */
async function tap(page, text, { exact = false } = {}) {
  const target = page.getByText(text, { exact }).filter({ visible: true }).first();
  await target.waitFor({ state: "visible", timeout: 15000 });
  await target.click();
  await page.waitForTimeout(SETTLE_MS);
}

/**
 * Open a list card by its text.
 *
 * `.last()` is load-bearing. react-navigation keeps inactive tab screens mounted
 * and laid out, so Playwright reports the hidden Home screen's copy of a client
 * name as visible and then times out clicking it underneath the active screen.
 * Screens mount in visit order, so the active screen's copy is always the last.
 */
async function tapCard(page, text) {
  const card = page.getByText(text).filter({ visible: true }).last();
  await card.waitFor({ state: "visible", timeout: 15000 });
  await card.click();
  await page.waitForTimeout(SETTLE_MS + 400);
}

async function shoot(page, dir, name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(dir, `${name}.png`) });
  console.log(`    ✓ ${name}`);
}

/** One screen = one step. Isolated so a flaky step can't abandon the whole run. */
const STEPS = [
  {
    name: "01-home",
    run: async (page, dir) => {
      await shoot(page, dir, "01-home");
    },
  },
  {
    name: "02-estimates",
    run: async (page, dir) => {
      await tap(page, "Estimates");
      await shoot(page, dir, "02-estimates");
    },
  },
  {
    name: "03-estimate-detail",
    run: async (page, dir) => {
      await tap(page, "Estimates");
      // Novak / $12,400 — the seeded estimate with the most line items, so the
      // margin hero doesn't sit above half a screen of empty space.
      await tapCard(page, "Panel upgrade — 200A service");
      await shoot(page, dir, "03-estimate-detail");
    },
  },
  {
    name: "04-line-margin",
    run: async (page, dir) => {
      await tap(page, "Estimates");
      await tapCard(page, "Panel upgrade — 200A service");
      // The per-line cost/markup editor — the feature no competitor has.
      await tapCard(page, "200A panel + meter base");
      await shoot(page, dir, "04-line-margin");
    },
  },
  {
    name: "05-invoices",
    run: async (page, dir) => {
      await tap(page, "Invoices");
      await shoot(page, dir, "05-invoices");
    },
  },
  {
    name: "06-invoice-detail",
    run: async (page, dir) => {
      await tap(page, "Invoices");
      // INV-1001 (Novak, $12,400, Paid) — shows the paid status banner.
      await tapCard(page, "INV-1001 · due Aug 10");
      await shoot(page, dir, "06-invoice-detail");
    },
  },
  {
    name: "07-invoice-overdue",
    run: async (page, dir) => {
      await tap(page, "Invoices");
      // INV-1004 (Hartley, overdue) — surfaces the reminder + pay-link actions
      // that the paid invoice in 06 doesn't show.
      await tapCard(page, "INV-1004 · due Jul 26");
      await shoot(page, dir, "07-invoice-overdue");
    },
  },
  {
    name: "08-expenses",
    run: async (page, dir) => {
      await tap(page, "Expenses");
      await shoot(page, dir, "08-expenses");
    },
  },
  {
    name: "09-get-paid-export",
    run: async (page, dir) => {
      await page.goto(`${APP_URL}/settings`);
      await page.waitForTimeout(SETTLE_MS + 400);
      await shoot(page, dir, "09-get-paid-export");
    },
  },
];

async function captureDevice(browser, device) {
  const dir = join(OUT_ROOT, device.slot);
  await mkdir(dir, { recursive: true });
  console.log(`\n▸ ${device.slot} (${device.note}) — ${device.width * 3}×${device.height * 3}`);

  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: 3,
    colorScheme: "dark",
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  // Fresh context = empty SQLite DB, so onboarding runs first. The demo seed is
  // tuned to look real and is pinned by demo.test.ts.
  await page.goto(APP_URL);
  await page.waitForTimeout(3500);
  await tap(page, "Load demo data (Reyes Electric)");
  await page.waitForTimeout(2500);

  const failed = [];
  for (const step of STEPS) {
    try {
      await page.goto(APP_URL);
      await page.waitForTimeout(SETTLE_MS);
      await step.run(page, dir, device);
    } catch (error) {
      failed.push(step.name);
      console.log(`    ✗ ${step.name}: ${error.message.split("\n")[0]}`);
    }
  }

  await context.close();
  return failed;
}

const browser = await chromium.launch();
const report = {};
for (const device of DEVICES) {
  report[device.slot] = await captureDevice(browser, device);
}
await browser.close();

console.log("\n── summary ──");
for (const [slot, failed] of Object.entries(report)) {
  const ok = STEPS.length - failed.length;
  console.log(`${slot}: ${ok}/${STEPS.length}${failed.length ? ` (failed: ${failed.join(", ")})` : ""}`);
}
