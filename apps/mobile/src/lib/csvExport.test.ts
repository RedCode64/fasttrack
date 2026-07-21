import { describe, expect, it } from "vitest";

import { buildLedgerCsv, csvEscape } from "./csvExport";

describe("csvEscape", () => {
  it("leaves plain values untouched and quotes commas, quotes, and newlines", () => {
    expect(csvEscape("Chen")).toBe("Chen");
    expect(csvEscape("Smith, Jr.")).toBe('"Smith, Jr."');
    expect(csvEscape('He said "hi"')).toBe('"He said ""hi"""');
  });
});

describe("buildLedgerCsv", () => {
  it("writes a signed cash ledger sorted by date with a header row", () => {
    const csv = buildLedgerCsv({
      payments: [
        { paidAtIso: "2026-07-16T00:00:00.000Z", clientName: "Whitfield", invoiceNumber: 1004, amountCents: 32000, method: "check" },
      ],
      expenses: [
        { spentAtIso: "2026-07-10", party: "Shell", category: "Fuel", amountCents: 8600 },
      ],
    });
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Date,Type,Name,Detail,Amount");
    // Expense (Jul 10) sorts before the payment (Jul 16).
    expect(lines[1]).toBe("2026-07-10,Expense,Shell,Fuel,-86.00");
    expect(lines[2]).toBe("2026-07-16,Payment,Whitfield,INV-1004 · check,320.00");
  });

  it("quotes a vendor name that contains a comma", () => {
    const csv = buildLedgerCsv({
      payments: [],
      expenses: [{ spentAtIso: "2026-07-01", party: "City Electric, Inc.", category: "Materials", amountCents: 41200 }],
    });
    expect(csv).toContain('"City Electric, Inc."');
  });
});
