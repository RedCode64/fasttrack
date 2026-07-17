import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Load apps/web/.env.local and hand the NEXT_PUBLIC_* vars to the dev server
 * process explicitly. Through Playwright's webServer wrapper Next.js does not
 * reliably auto-load .env.local, so inject it — Next inlines from process.env.
 */
function loadEnvLocal(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    for (const line of readFileSync(join(__dirname, ".env.local"), "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    // No .env.local — the app will surface its own "not configured" error.
  }
  return env;
}

/**
 * E2E against the live demo org (read-only flows only). Runs the dev server on
 * a dedicated port so it never collides with a manual `pnpm dev`. Kept out of
 * the turbo `test` gate — needs a browser install and the live Supabase.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  use: { baseURL: "http://localhost:3400" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "pnpm exec next dev -p 3400",
    url: "http://localhost:3400/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: loadEnvLocal(),
  },
});
