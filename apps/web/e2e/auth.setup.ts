import { expect, test as setup } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "demo@fasttrack.app";
const PASSWORD = process.env.E2E_PASSWORD ?? "FastTrack-Demo-2026!";

/** Log in once against the demo org and save cookies for the dashboard project. */
setup("authenticate as the demo org", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/$/);
  await expect(page.locator("h1").first()).toBeVisible();
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
