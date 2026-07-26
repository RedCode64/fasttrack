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

/**
 * The delete-account control, short of actually deleting anything. It is the
 * one irreversible button on the dashboard, so the guards around it — stays
 * closed until asked for, stays disabled until the word is typed — are worth a
 * regression test of their own. Nothing here submits the form.
 */
test.describe("delete account guards", () => {
  test("stays shut until asked, and disabled until DELETE is typed", async ({ page }) => {
    await page.goto("/settings");

    const open = page.getByRole("button", { name: "Delete my account" });
    await expect(open).toBeVisible();
    await expect(page.locator("#confirm-delete")).toHaveCount(0);

    await open.click();
    const confirm = page.locator("#confirm-delete");
    await expect(confirm).toBeVisible();

    const submit = page.getByRole("button", { name: "Permanently delete" });
    await expect(submit).toBeDisabled();

    await confirm.fill("delete my stuff");
    await expect(submit).toBeDisabled();

    await confirm.fill("DELETE");
    await expect(submit).toBeEnabled();

    // Back out — the demo org has to survive this test.
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator("#confirm-delete")).toHaveCount(0);
  });
});

test.describe("password recovery", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("offers a reset path from the sign-in form", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading")).toContainText(/Reset your password/);
    // Password field is gone in reset mode — only the address is needed.
    await expect(page.getByLabel("Password")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
  });
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("dashboard redirects to /login", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/login/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});
