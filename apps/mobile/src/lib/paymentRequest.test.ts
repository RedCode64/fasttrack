import { describe, expect, it } from "vitest";

import { buildPaymentRequest } from "./paymentRequest";

const base = {
  businessName: "Reyes Electric",
  clientName: "Chen",
  invoiceNumber: 1004,
  balanceCents: 32000,
  dueAtIso: "2026-07-23T00:00:00.000Z",
  isOverdue: false,
} as const;

describe("buildPaymentRequest", () => {
  it("addresses the client and states the invoice, amount, and due date", () => {
    const msg = buildPaymentRequest(base);
    expect(msg).toContain("Hi Chen,");
    expect(msg).toContain("INV-1004");
    expect(msg).toContain("$320.00");
    expect(msg).toContain("due Jul 23");
    expect(msg.trimEnd().endsWith("Reyes Electric")).toBe(true);
  });

  it("switches to past-due wording for overdue invoices", () => {
    const msg = buildPaymentRequest({ ...base, isOverdue: true });
    expect(msg).toContain("past due");
    expect(msg).not.toContain("Here's invoice");
  });

  it("includes a pay-online line only when a pay link is set", () => {
    expect(buildPaymentRequest(base)).not.toContain("Pay online");
    const withLink = buildPaymentRequest({ ...base, payLink: "https://venmo.com/reyes" });
    expect(withLink).toContain("Pay online: https://venmo.com/reyes");
  });

  it("ignores a blank pay link and omits the due date when unknown", () => {
    const msg = buildPaymentRequest({ ...base, payLink: "   ", dueAtIso: null });
    expect(msg).not.toContain("Pay online");
    expect(msg).not.toContain("due ");
  });
});
