import { describe, expect, it } from "vitest";

import { toPgRow } from "./transform";

describe("toPgRow", () => {
  it("converts INTEGER booleans on the three boolean columns", () => {
    expect(toPgRow("estimate_lines", { id: "a", is_taxable: 1 })).toEqual({ id: "a", is_taxable: true });
    expect(toPgRow("invoice_lines", { id: "b", is_taxable: 0 })).toEqual({ id: "b", is_taxable: false });
    expect(toPgRow("expenses", { id: "c", is_billable: 1, ocr_extracted: null }))
      .toEqual({ id: "c", is_billable: true, ocr_extracted: null });
  });

  it("parses TEXT JSON columns into objects (null stays null)", () => {
    expect(toPgRow("organizations", { id: "o", tax_config: '{"name":"Sales tax","rate_bps":825}' }))
      .toEqual({ id: "o", tax_config: { name: "Sales tax", rate_bps: 825 } });
    expect(toPgRow("expenses", { id: "e", is_billable: 0, ocr_extracted: '{"total":12}' }))
      .toEqual({ id: "e", is_billable: false, ocr_extracted: { total: 12 } });
  });

  it("passes untouched tables/columns through unchanged", () => {
    const row = { id: "x", org_id: "o", name: "Dana", created_at: "2026-07-01T00:00:00.000Z" };
    expect(toPgRow("clients", row)).toEqual(row);
  });

  it("throws on malformed JSON rather than pushing garbage", () => {
    expect(() => toPgRow("organizations", { id: "o", tax_config: "{nope" })).toThrow(/tax_config/);
  });
});
