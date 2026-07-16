import { describe, expect, it } from "vitest";
import {
  estimateStatusSchema,
  invoiceStatusSchema,
  jobStatusSchema,
  lineKindSchema,
  membershipRoleSchema,
  paymentMethodSchema,
  priceBookKindSchema,
  tradeSchema,
} from "./enums.js";

describe("status enums", () => {
  it("job status includes in_progress — the dashboard renders it (reconciliation)", () => {
    expect(jobStatusSchema.parse("in_progress")).toBe("in_progress");
    expect(() => jobStatusSchema.parse("cancelled")).toThrow();
  });

  it("estimate status covers the full spec lifecycle", () => {
    for (const s of ["draft", "sent", "viewed", "accepted", "declined", "expired"]) {
      expect(estimateStatusSchema.parse(s)).toBe(s);
    }
  });

  it("invoice status includes partial", () => {
    expect(invoiceStatusSchema.parse("partial")).toBe("partial");
    expect(() => invoiceStatusSchema.parse("accepted")).toThrow();
  });
});

describe("payment methods", () => {
  it("includes bank_transfer (reconciliation item 7)", () => {
    expect(paymentMethodSchema.parse("bank_transfer")).toBe("bank_transfer");
  });
  it("rejects raw card — card processing is R5", () => {
    expect(() => paymentMethodSchema.parse("card")).toThrow();
  });
});

describe("kinds and roles", () => {
  it("lines can be material, labor, or other; price book only material or labor", () => {
    expect(lineKindSchema.parse("other")).toBe("other");
    expect(() => priceBookKindSchema.parse("other")).toThrow();
  });
  it("membership roles are owner and member", () => {
    expect(membershipRoleSchema.parse("owner")).toBe("owner");
    expect(() => membershipRoleSchema.parse("admin")).toThrow();
  });
  it("trades cover the launch verticals", () => {
    expect(tradeSchema.parse("electrical")).toBe("electrical");
    expect(tradeSchema.parse("other")).toBe("other");
  });
});
