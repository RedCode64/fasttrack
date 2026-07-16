import { describe, expect, it } from "vitest";
import { budgetSchema, expenseCategorySchema, expenseSchema } from "./expense.js";

const validExpense = {
  id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
  org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
  job_id: "4f2b9f4d-5c6e-4a8b-9d0e-2f3a4b5c6d7e",
  category_id: "7c5e2c7a-8f9b-4d1e-a03b-5c6d7e8f9a0b",
  vendor: "City Electric Supply",
  description: "Breakers and wire",
  amount_cents: 21_050,
  spent_at: "2026-07-14",
  is_billable: true,
  receipt_storage_path: "org/1c9e6c1a/receipts/r-001.jpg",
  ocr_extracted: null,
  created_at: "2026-07-14T15:00:00+00:00",
  updated_at: "2026-07-14T15:00:00+00:00",
  deleted_at: null,
};

describe("expenseSchema", () => {
  it("parses a billable job expense — a permit gets passed through to the client", () => {
    const parsed = expenseSchema.parse(validExpense);
    expect(parsed.is_billable).toBe(true);
    expect(parsed.job_id).not.toBeNull();
  });

  it("parses overhead: null job, not billable — the fuel tank scenario", () => {
    const parsed = expenseSchema.parse({
      ...validExpense,
      job_id: null,
      is_billable: false,
      vendor: "Shell",
    });
    expect(parsed.job_id).toBeNull();
  });

  it("keeps job attribution and billability independent (reconciliation item 4)", () => {
    // Attributable to the job but NOT billable — the distinction the old spec couldn't express.
    const parsed = expenseSchema.parse({ ...validExpense, is_billable: false });
    expect(parsed.job_id).not.toBeNull();
    expect(parsed.is_billable).toBe(false);
  });

  it("accepts OCR extraction payloads for later receipt scanning", () => {
    const parsed = expenseSchema.parse({
      ...validExpense,
      ocr_extracted: { vendor: "City Electric Supply", total_cents: 21050, confidence: 0.94 },
    });
    expect(parsed.ocr_extracted).not.toBeNull();
  });

  it("rejects a zero-amount expense", () => {
    expect(() => expenseSchema.parse({ ...validExpense, amount_cents: 0 })).toThrow();
  });
});

describe("expenseCategorySchema", () => {
  it("parses a category", () => {
    const parsed = expenseCategorySchema.parse({
      id: "7c5e2c7a-8f9b-4d1e-a03b-5c6d7e8f9a0b",
      org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
      name: "Materials",
      sort_order: 0,
      created_at: "2026-07-16T12:00:00+00:00",
      updated_at: "2026-07-16T12:00:00+00:00",
      deleted_at: null,
    });
    expect(parsed.name).toBe("Materials");
  });
});

describe("budgetSchema", () => {
  const validBudget = {
    id: "9d6f3d9c-0a1b-4e2f-b14c-6d7e8f9a0b1c",
    org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
    category_id: "7c5e2c7a-8f9b-4d1e-a03b-5c6d7e8f9a0b",
    month: "2026-07-01",
    amount_cents: 500_000,
    created_at: "2026-07-01T00:00:00+00:00",
    updated_at: "2026-07-01T00:00:00+00:00",
    deleted_at: null,
  };

  it("parses a monthly category budget", () => {
    expect(budgetSchema.parse(validBudget).month).toBe("2026-07-01");
  });

  it("rejects a month that isn't the first of the month", () => {
    expect(() => budgetSchema.parse({ ...validBudget, month: "2026-07-15" })).toThrow();
  });
});
