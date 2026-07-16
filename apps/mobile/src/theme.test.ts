import { estimateStatusSchema, invoiceStatusSchema } from "@fasttrack/schema";
import { describe, expect, it } from "vitest";

import { statusLabel, statusPill } from "./theme";

describe("statusPill", () => {
  it("covers every estimate status", () => {
    for (const status of estimateStatusSchema.options) {
      expect(statusPill[status], `missing pill for ${status}`).toBeDefined();
    }
  });

  it("covers every invoice status plus derived overdue", () => {
    for (const status of invoiceStatusSchema.options) {
      expect(statusPill[status], `missing pill for ${status}`).toBeDefined();
    }
    expect(statusPill.overdue).toBeDefined();
  });
});

describe("statusLabel", () => {
  it("title-cases and de-snakes", () => {
    expect(statusLabel("in_progress")).toBe("In progress");
    expect(statusLabel("paid")).toBe("Paid");
  });
});
