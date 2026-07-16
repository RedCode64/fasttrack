import { describe, expect, it } from "vitest";
import { invoiceLineSchema, invoiceSchema, paymentSchema } from "./invoice.js";

const validInvoice = {
  id: "3e1a8e3c-4b5d-4f7a-8c9d-1e2f3a4b5c6d",
  org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
  job_id: "4f2b9f4d-5c6e-4a8b-9d0e-2f3a4b5c6d7e",
  converted_from_estimate_id: "5a3c0a5e-6d7f-4b9c-8e1f-3a4b5c6d7e8f",
  number: 2001,
  status: "partial",
  issued_at: "2026-07-10T09:00:00+00:00",
  due_at: "2026-08-09T09:00:00+00:00",
  subtotal_cents: 310_600,
  tax_cents: 0,
  discount_cents: 0,
  total_cents: 310_600,
  balance_cents: 110_600,
  notes: null,
  terms: "Net 30",
  pdf_url: null,
  created_at: "2026-07-10T09:00:00+00:00",
  updated_at: "2026-07-14T09:00:00+00:00",
  deleted_at: null,
};

const validPayment = {
  id: "6b4d1b6f-7e8a-4c0d-9f2a-4b5c6d7e8f9a",
  org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
  invoice_id: "3e1a8e3c-4b5d-4f7a-8c9d-1e2f3a4b5c6d",
  amount_cents: 200_000,
  method: "bank_transfer",
  paid_at: "2026-07-14T09:00:00+00:00",
  reference: null,
  notes: null,
  created_at: "2026-07-14T09:00:00+00:00",
  updated_at: "2026-07-14T09:00:00+00:00",
  deleted_at: null,
};

describe("invoiceSchema", () => {
  it("parses a partially-paid converted invoice with a link back to its estimate", () => {
    const parsed = invoiceSchema.parse(validInvoice);
    expect(parsed.converted_from_estimate_id).toBe("5a3c0a5e-6d7f-4b9c-8e1f-3a4b5c6d7e8f");
    expect(parsed.balance_cents).toBe(110_600);
  });

  it("allows a negative balance — overpayment happens in the real world", () => {
    expect(invoiceSchema.parse({ ...validInvoice, balance_cents: -5_000 }).balance_cents).toBe(
      -5_000,
    );
  });

  it("parses an invoice created from scratch — conversion link is nullable", () => {
    expect(
      invoiceSchema.parse({ ...validInvoice, converted_from_estimate_id: null })
        .converted_from_estimate_id,
    ).toBeNull();
  });
});

describe("invoiceLineSchema", () => {
  it("carries invoice_id instead of estimate_id, same shape otherwise", () => {
    const parsed = invoiceLineSchema.parse({
      id: "8f14e45f-ea3a-4e08-b7b8-2f5a0c1d9e3b",
      org_id: "1c9e6c1a-2f3b-4d5e-8a7b-9c0d1e2f3a4b",
      invoice_id: "3e1a8e3c-4b5d-4f7a-8c9d-1e2f3a4b5c6d",
      sort_order: 0,
      kind: "labor",
      description: "Service change",
      quantity: 16,
      unit: "hr",
      unit_cost_cents: 6_500,
      markup_pct: 5_500,
      unit_price_cents: 10_075,
      is_taxable: false,
      price_book_item_id: null,
      created_at: "2026-07-10T09:00:00+00:00",
      updated_at: "2026-07-10T09:00:00+00:00",
      deleted_at: null,
    });
    expect(parsed.invoice_id).toBe("3e1a8e3c-4b5d-4f7a-8c9d-1e2f3a4b5c6d");
  });
});

describe("paymentSchema", () => {
  it("parses the design's bank transfer payment", () => {
    expect(paymentSchema.parse(validPayment).method).toBe("bank_transfer");
  });

  it("rejects a zero-amount payment", () => {
    expect(() => paymentSchema.parse({ ...validPayment, amount_cents: 0 })).toThrow();
  });
});
