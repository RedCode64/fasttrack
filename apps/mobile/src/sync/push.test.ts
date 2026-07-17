import { describe, expect, it } from "vitest";

import { createOrg } from "../db/repos/orgRepo";
import { createTestCtx } from "../db/repos/testUtils";
import { collectPush, pushAll, PUSH_TABLES, type SyncTarget } from "./push";

async function seededCtx() {
  const { ctx } = await createTestCtx();
  const org = await createOrg(ctx, {
    name: "Test Electric",
    trade: "electrical",
    targetMarginBps: 3000,
    taxRateBps: 825,
  });
  return { ctx, org };
}

function fakeTarget() {
  const calls: {
    table: string;
    rows: readonly Record<string, unknown>[];
    onConflict: string;
    ignoreDuplicates: boolean;
  }[] = [];
  const target: SyncTarget = {
    async upsert(table, rows, opts) {
      calls.push({
        table,
        rows,
        onConflict: opts.onConflict,
        ignoreDuplicates: opts.ignoreDuplicates ?? false,
      });
    },
  };
  return { target, calls };
}

describe("collectPush", () => {
  it("returns batches in FK-safe order with only this org's rows", async () => {
    const { ctx, org } = await seededCtx();
    const batches = await collectPush(ctx, org.id);
    expect(batches.map((b) => b.table)).toEqual([...PUSH_TABLES]);
    const orgBatch = batches.find((b) => b.table === "organizations");
    expect(orgBatch?.rows).toHaveLength(1);
    expect(orgBatch?.rows[0]?.tax_config).toEqual({ name: "Sales tax", rate_bps: 825 });
    const pb = batches.find((b) => b.table === "price_book_items");
    expect(pb?.rows.length).toBeGreaterThan(0); // electrical slice seeded by createOrg
  });

  it("includes soft-deleted rows so deletes propagate", async () => {
    const { ctx, org } = await seededCtx();
    const item = (await ctx.driver.exec("SELECT id FROM price_book_items LIMIT 1"))[0];
    await ctx.driver.exec("UPDATE price_book_items SET deleted_at = ? WHERE id = ?", [
      ctx.now(),
      String(item?.id),
    ]);
    const batches = await collectPush(ctx, org.id);
    const rows = batches.find((b) => b.table === "price_book_items")?.rows ?? [];
    expect(rows.some((r) => r.deleted_at !== null)).toBe(true);
  });
});

describe("pushAll", () => {
  it("bootstraps users → organizations → memberships before data tables", async () => {
    const { ctx, org } = await seededCtx();
    const { target, calls } = fakeTarget();
    const summary = await pushAll(target, ctx, org, {
      id: "user-1",
      email: "a@b.c",
      name: "Ana",
    });
    expect(calls[0]?.table).toBe("users");
    expect(calls[1]?.table).toBe("organizations");
    expect(calls[1]?.onConflict).toBe("id");
    expect(calls[1]?.ignoreDuplicates).toBe(true); // insert-or-skip: never the members-only UPDATE path
    expect(calls[2]?.table).toBe("memberships");
    expect(calls[2]?.onConflict).toBe("org_id,user_id");
    expect(calls[2]?.ignoreDuplicates).toBe(true);
    // A fresh org has rows only in the two seeded tables; empty tables are skipped.
    expect(calls.map((c) => c.table).slice(3)).toEqual(["price_book_items", "expense_categories"]);
    expect(summary.find((s) => s.table === "expense_categories")?.count).toBe(8);
  });

  it("skips empty tables instead of issuing empty upserts", async () => {
    const { ctx, org } = await seededCtx();
    const { target, calls } = fakeTarget();
    await pushAll(target, ctx, org, { id: "u", email: "a@b.c", name: "A" });
    expect(calls.every((c) => c.rows.length > 0)).toBe(true);
  });
});
