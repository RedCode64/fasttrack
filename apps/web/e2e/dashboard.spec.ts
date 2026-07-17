import { expect, test } from "@playwright/test";

/** route → its real <h1> — all 12 design screens. Read-only: no mutations of demo data. */
const SCREENS: ReadonlyArray<readonly [string, RegExp]> = [
  ["/", /Financial Position/],
  ["/spend", /Spend by Category/],
  ["/budgets", /Budgets/],
  ["/tips", /Optimization Tips/],
  ["/revenue", /Revenue & Receivables/],
  ["/profit", /Job Profitability/],
  ["/jobs", /Jobs/],
  ["/clients", /Clients/],
  ["/invoices", /Invoices/],
  ["/expenses", /Expenses/],
  ["/reports", /Reports & Export/],
  ["/settings", /Settings/],
];

for (const [route, heading] of SCREENS) {
  test(`renders ${route} with its heading and no page errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(route);
    await expect(page.locator("h1").first()).toContainText(heading);
    expect(errors).toEqual([]);
  });
}

test("home shows the live health gauge with a numeric score", async ({ page }) => {
  await page.goto("/");
  // The gauge renders role="img" with aria-label "Health score N" — a live value,
  // not the old hardcoded 72 (which was a plain heading before Plan 1).
  await expect(page.getByRole("img", { name: /Health score \d+/ })).toBeVisible();
});

test("invoices screen lists the demo org's invoices", async ({ page }) => {
  await page.goto("/invoices");
  await expect(page.locator("table tbody tr").first()).toBeVisible();
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("dashboard redirects to /login", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/login/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});
