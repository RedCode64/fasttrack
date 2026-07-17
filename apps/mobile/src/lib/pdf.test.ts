import { cents } from "@fasttrack/core";
import { describe, expect, it } from "vitest";

import { buildDocumentHtml, type PdfDocumentInput } from "./pdf";

const BASE: PdfDocumentInput = {
  docType: "estimate",
  docNumber: "EST-1001",
  orgName: "Reyes Electric",
  orgAddress: "1200 Alamo St, San Antonio, TX",
  orgLicense: "TX-EL-44821",
  clientName: "Novak",
  clientAddress: null,
  jobTitle: "Panel upgrade — 200A service",
  issuedAt: "2026-07-16T15:00:00.000Z",
  dueAt: null,
  subtotalCents: 217900,
  taxCents: 4678,
  totalCents: 222578,
  taxName: "Sales tax",
  taxRateBps: 825,
  notes: "Utility disconnect scheduled with CPS.",
  terms: null,
  lines: [
    {
      kind: "labor",
      description: "Rough-in wiring",
      quantity: 16,
      unit: "hr",
      unitPriceCents: cents(10075),
    },
    {
      kind: "material",
      description: "200A panel — Square D QO",
      quantity: 1,
      unit: "ea",
      unitPriceCents: cents(56700),
    },
  ],
};

describe("buildDocumentHtml (decision 8 — prices only, grouped by kind)", () => {
  it("groups lines under Materials before Labor and shows prices + totals", () => {
    const html = buildDocumentHtml(BASE);

    expect(html).toContain("ESTIMATE");
    expect(html).toContain("EST-1001");
    expect(html).toContain("Reyes Electric");
    expect(html).toContain("Novak");
    expect(html).toContain("Panel upgrade — 200A service");

    const materials = html.indexOf("Materials");
    const labor = html.indexOf("Labor");
    expect(materials).toBeGreaterThan(-1);
    expect(labor).toBeGreaterThan(materials);
    expect(html).not.toContain("Other"); // no other-kind lines in this doc

    expect(html).toContain("$567.00"); // unit price
    expect(html).toContain("16 hr");
    expect(html).toContain("$1,612.00"); // 16 × $100.75
    expect(html).toContain("$2,179.00"); // subtotal
    expect(html).toContain("Sales tax (8.25%)");
    expect(html).toContain("$46.78");
    expect(html).toContain("$2,225.78"); // total
  });

  it("never leaks cost or markup", () => {
    const html = buildDocumentHtml(BASE);
    expect(html).not.toMatch(/markup/i);
    expect(html).not.toMatch(/\bcost\b/i);
    // the material line's snapshot cost is $420.00 — must not appear
    expect(html).not.toContain("$420.00");
  });

  it("renders invoice chrome with a due date", () => {
    const html = buildDocumentHtml({
      ...BASE,
      docType: "invoice",
      docNumber: "INV-1001",
      dueAt: "2026-07-30T15:00:00.000Z",
    });
    expect(html).toContain("INVOICE");
    expect(html).toContain("INV-1001");
    expect(html).toContain("Due Jul 30");
    expect(html).not.toContain("ESTIMATE");
  });

  it("escapes user-entered HTML", () => {
    const html = buildDocumentHtml({
      ...BASE,
      clientName: "<b>Sneaky</b> & Co",
      lines: [
        {
          kind: "material",
          description: "<script>alert(1)</script>",
          quantity: 1,
          unit: "ea",
          unitPriceCents: cents(1000),
        },
      ],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;Sneaky&lt;/b&gt; &amp; Co");
  });

  it("hides the tax row for tax-free documents", () => {
    const html = buildDocumentHtml({ ...BASE, taxCents: 0, taxRateBps: 0 });
    expect(html).not.toContain("Sales tax");
  });
});
