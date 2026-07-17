import { defineConfig } from "vitest/config";

/**
 * Vitest owns unit tests under src/ only. The Playwright suite in e2e/ is a
 * separate runner (`pnpm e2e`) and must never be collected here — its
 * `@playwright/test` imports don't run under vitest.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
});
