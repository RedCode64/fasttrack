import { describe, expect, it } from "vitest";

import { createDraft } from "./estimateRepo";
import {
  createExpense,
  deleteExpense,
  getExpense,
  listCategories,
  listExpenses,
  monthSummary,
  updateExpense,
} from "./expenseRepo";
import { createOrg } from "./orgRepo";
import { createTestCtx, type TestCtx } from "./testUtils";

async function setup(): Promise<{ t: TestCtx; orgId: string; materialsId: string }> {
  const t = await createTestCtx("2026-07-16T12:00:00.000Z");
  const org = await createOrg(t.ctx, {
    name: "Reyes Electric",
    trade: "electrical",
    targetMarginBps: 3000,
    taxRateBps: 0,
  });
  const categories = await listCategories(t.ctx, org.id);
  const materials = categories.find((c) => c.name === "Materials");
  if (!materials) throw new Error("Materials category missing");
  return { t, orgId: org.id, materialsId: materials.id };
}

describe("expenseRepo", () => {
  it("lists the seeded categories in sort order", async () => {
    const { t, orgId } = await setup();
    const names = (await listCategories(t.ctx, orgId)).map((c) => c.name);
    expect(names[0]).toBe("Materials");
    expect(names).toHaveLength(8);
  });

  it("creates an expense with job attribution and billable flag", async () => {
    const { t, orgId, materialsId } = await setup();
    const est = await createDraft(t.ctx, orgId, {
      newClientName: "Novak",
      jobTitle: "Panel upgrade",
    });
    const jobRows = await t.ctx.driver.exec("SELECT id FROM jobs");
    const jobId = String(jobRows[0]?.id);
    void est;

    const expense = await createExpense(t.ctx, orgId, {
      categoryId: materialsId,
      amountCents: 41200,
      spentAt: "2026-07-14",
      vendor: "City Electric Supply",
      jobId,
      isBillable: true,
      receiptPath: "receipts/receipt-1.jpg",
    });

    expect(expense.amount_cents).toBe(41200);
    expect(expense.is_billable).toBe(true);
    expect(expense.job_id).toBe(jobId);
    expect(expense.receipt_storage_path).toBe("receipts/receipt-1.jpg");

    const fetched = await getExpense(t.ctx, expense.id);
    expect(fetched?.vendor).toBe("City Electric Supply");
  });

  it("lists newest-first with category and job labels", async () => {
    const { t, orgId, materialsId } = await setup();
    await createExpense(t.ctx, orgId, {
      categoryId: materialsId,
      amountCents: 8600,
      spentAt: "2026-07-13",
      vendor: "Shell",
      isBillable: false,
    });
    await createExpense(t.ctx, orgId, {
      categoryId: materialsId,
      amountCents: 41200,
      spentAt: "2026-07-14",
      vendor: "City Electric Supply",
      isBillable: true,
    });

    const rows = await listExpenses(t.ctx, orgId);
    expect(rows.map((r) => r.expense.vendor)).toEqual(["City Electric Supply", "Shell"]);
    expect(rows[0]?.categoryName).toBe("Materials");
    expect(rows[0]?.jobTitle).toBeNull(); // overhead
  });

  it("updates fields and reflects them on read", async () => {
    const { t, orgId, materialsId } = await setup();
    const expense = await createExpense(t.ctx, orgId, {
      categoryId: materialsId,
      amountCents: 1000,
      spentAt: "2026-07-10",
      isBillable: false,
    });
    await updateExpense(t.ctx, expense.id, { amountCents: 2500, vendor: "Graybar" });
    const fetched = await getExpense(t.ctx, expense.id);
    expect(fetched?.amount_cents).toBe(2500);
    expect(fetched?.vendor).toBe("Graybar");
  });

  it("soft-deletes: gone from reads, row retained", async () => {
    const { t, orgId, materialsId } = await setup();
    const expense = await createExpense(t.ctx, orgId, {
      categoryId: materialsId,
      amountCents: 5000,
      spentAt: "2026-07-12",
      isBillable: false,
    });
    await deleteExpense(t.ctx, expense.id);
    expect(await getExpense(t.ctx, expense.id)).toBeNull();
    expect(await listExpenses(t.ctx, orgId)).toHaveLength(0);
    const raw = await t.ctx.driver.exec("SELECT deleted_at FROM expenses WHERE id = ?", [
      expense.id,
    ]);
    expect(raw[0]?.deleted_at).not.toBeNull();
  });

  it("sums the calendar month and the trailing 7 days", async () => {
    const { t, orgId, materialsId } = await setup();
    const add = (amountCents: number, spentAt: string) =>
      createExpense(t.ctx, orgId, {
        categoryId: materialsId,
        amountCents,
        spentAt,
        isBillable: false,
      });
    await add(10000, "2026-07-01"); // in month, outside week
    await add(20000, "2026-07-14"); // in month + week
    await add(30000, "2026-07-16"); // today
    await add(99900, "2026-06-30"); // previous month

    const summary = await monthSummary(t.ctx, orgId);
    expect(summary.monthCents).toBe(60000);
    expect(summary.weekCents).toBe(50000); // 2026-07-10 .. 07-16
  });
});
