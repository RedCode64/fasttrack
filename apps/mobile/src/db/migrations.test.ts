import { beforeEach, describe, expect, it } from "vitest";

import type { SqlDriver } from "./driver";
import { migrate } from "./migrations";
import { createTestDriver } from "./sqlJsDriver";

const EXPECTED_TABLES = [
  "organizations",
  "clients",
  "jobs",
  "price_book_items",
  "estimates",
  "estimate_lines",
  "invoices",
  "invoice_lines",
  "payments",
  "expense_categories",
  "expenses",
] as const;

let driver: SqlDriver;

beforeEach(async () => {
  driver = await createTestDriver();
});

async function userVersion(): Promise<number> {
  const rows = await driver.exec("PRAGMA user_version");
  return Number(rows[0]?.user_version ?? Number.NaN);
}

describe("migrate", () => {
  it("creates every domain table and stamps user_version", async () => {
    await migrate(driver);

    expect(await userVersion()).toBe(1);
    const rows = await driver.exec(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    const names = rows.map((r) => r.name);
    for (const table of EXPECTED_TABLES) {
      expect(names, `missing table ${table}`).toContain(table);
    }
  });

  it("is idempotent — a second run is a no-op", async () => {
    await migrate(driver);
    await migrate(driver);
    expect(await userVersion()).toBe(1);
  });

  it("enforces foreign keys on the migrated connection", async () => {
    await migrate(driver);
    await expect(
      driver.exec(
        `INSERT INTO clients (id, org_id, name, email, phone, address, notes, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, NULL)`,
        [
          "22222222-2222-4222-8222-222222222222",
          "99999999-9999-4999-8999-999999999999", // no such org
          "Ghost Client",
          "2026-07-16T00:00:00.000Z",
          "2026-07-16T00:00:00.000Z",
        ],
      ),
    ).rejects.toThrow(/foreign key/i);
  });

  it("rejects duplicate document numbers per org", async () => {
    await migrate(driver);
    const now = "2026-07-16T00:00:00.000Z";
    await driver.exec(
      `INSERT INTO organizations (id, name, logo_url, address, license_no, trade, tax_config, target_margin_bps, created_at)
       VALUES (?, ?, NULL, NULL, NULL, 'electrical', '{"name":"Sales tax","rate_bps":0}', 3000, ?)`,
      ["11111111-1111-4111-8111-111111111111", "Test Org", now],
    );
    await driver.exec(
      `INSERT INTO clients (id, org_id, name, email, phone, address, notes, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, NULL)`,
      ["22222222-2222-4222-8222-222222222222", "11111111-1111-4111-8111-111111111111", "C", now, now],
    );
    await driver.exec(
      `INSERT INTO jobs (id, org_id, client_id, title, address, scheduled_at, status, notes, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, NULL, NULL, 'quoted', NULL, ?, ?, NULL)`,
      [
        "33333333-3333-4333-8333-333333333333",
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "Job",
        now,
        now,
      ],
    );

    const insertEstimate = (id: string) =>
      driver.exec(
        `INSERT INTO estimates (id, org_id, job_id, number, status, issued_at, expires_at,
           subtotal_cents, tax_cents, discount_cents, total_cents, notes, terms, pdf_url,
           created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, 1001, 'draft', NULL, NULL, 0, 0, 0, 0, NULL, NULL, NULL, ?, ?, NULL)`,
        [
          id,
          "11111111-1111-4111-8111-111111111111",
          "33333333-3333-4333-8333-333333333333",
          now,
          now,
        ],
      );

    await insertEstimate("44444444-4444-4444-8444-444444444444");
    await expect(insertEstimate("55555555-5555-4555-8555-555555555555")).rejects.toThrow(
      /unique/i,
    );
  });
});
