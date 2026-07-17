import { lineTotal, type Cents } from "@fasttrack/core";
import type { LineKind } from "@fasttrack/schema";

import { money, shortDate } from "./format";

/**
 * Decision 8: customer-facing documents show PRICES ONLY, grouped by line
 * kind. Cost and markup are not part of this module's input type, so they
 * cannot leak. Pure string builder — printing lives in printPdf.ts.
 */

export interface PdfLine {
  readonly kind: LineKind;
  readonly description: string;
  readonly quantity: number;
  readonly unit: string;
  readonly unitPriceCents: Cents;
}

export interface PdfDocumentInput {
  readonly docType: "estimate" | "invoice";
  readonly docNumber: string;
  readonly orgName: string;
  readonly orgAddress: string | null;
  readonly orgLicense: string | null;
  readonly clientName: string;
  readonly clientAddress: string | null;
  readonly jobTitle: string;
  readonly issuedAt: string | null;
  readonly dueAt: string | null;
  readonly subtotalCents: number;
  readonly taxCents: number;
  readonly totalCents: number;
  readonly taxName: string;
  readonly taxRateBps: number;
  readonly notes: string | null;
  readonly terms: string | null;
  readonly lines: readonly PdfLine[];
}

const KIND_ORDER: readonly LineKind[] = ["material", "labor", "other"];
const KIND_HEADER: Record<LineKind, string> = {
  material: "Materials",
  labor: "Labor",
  other: "Other",
};

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function m(centsValue: number): string {
  return money(centsValue, { showCents: true });
}

function taxRateLabel(bps: number): string {
  const pct = bps / 100;
  const text = Number.isInteger(pct) ? String(pct) : pct.toFixed(2);
  return `${text}%`;
}

function lineRow(line: PdfLine): string {
  const total = lineTotal(line.unitPriceCents, line.quantity);
  return `
    <tr>
      <td class="desc">${esc(line.description)}</td>
      <td class="qty">${line.quantity} ${esc(line.unit)}</td>
      <td class="num">${m(line.unitPriceCents)}</td>
      <td class="num">${m(total)}</td>
    </tr>`;
}

function kindSection(kind: LineKind, lines: readonly PdfLine[]): string {
  const rows = lines.filter((l) => l.kind === kind);
  if (rows.length === 0) return "";
  return `
    <tr class="group"><td colspan="4">${KIND_HEADER[kind]}</td></tr>
    ${rows.map(lineRow).join("")}`;
}

export function buildDocumentHtml(input: PdfDocumentInput): string {
  const heading = input.docType === "invoice" ? "INVOICE" : "ESTIMATE";
  const dates = [
    input.issuedAt ? `Issued ${shortDate(input.issuedAt)}` : null,
    input.dueAt ? `Due ${shortDate(input.dueAt)}` : null,
  ]
    .filter((d): d is string => d !== null)
    .join(" · ");

  const taxRow =
    input.taxCents > 0
      ? `<tr><td>${esc(input.taxName)} (${taxRateLabel(input.taxRateBps)})</td><td class="num">${m(input.taxCents)}</td></tr>`
      : "";

  return `
<div class="page">
  <style>
    .page { font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
            color: #1c2622; padding: 36px 40px; font-size: 13px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 2px solid #1c7c4e; padding-bottom: 16px; }
    .org { font-size: 19px; font-weight: 800; }
    .org-meta { color: #707b75; font-size: 11.5px; margin-top: 4px; line-height: 1.5; }
    .doc { text-align: right; }
    .doc-type { font-size: 11px; letter-spacing: 2px; color: #1c7c4e; font-weight: 700; }
    .doc-num { font-size: 17px; font-weight: 700; margin-top: 2px; }
    .doc-dates { color: #707b75; font-size: 11.5px; margin-top: 4px; }
    .meta { display: flex; justify-content: space-between; margin: 18px 0 6px; }
    .label { font-size: 10px; letter-spacing: 1.5px; color: #a3aca6; font-weight: 700; }
    .value { margin-top: 3px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th { text-align: left; font-size: 10px; letter-spacing: 1px; color: #a3aca6;
         border-bottom: 1px solid #e7ebe6; padding: 6px 4px; }
    td { padding: 7px 4px; border-bottom: 1px solid #f0f2ee; vertical-align: top; }
    tr.group td { font-weight: 700; color: #1c7c4e; font-size: 11.5px; letter-spacing: 0.5px;
                  padding-top: 14px; border-bottom: none; }
    .qty { color: #707b75; white-space: nowrap; }
    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .totals { width: 45%; margin-left: auto; margin-top: 12px; }
    .totals td { border-bottom: none; padding: 3px 4px; }
    .totals .grand td { border-top: 2px solid #1c2622; font-weight: 800; font-size: 15px;
                        padding-top: 8px; }
    .notes { margin-top: 22px; color: #5c665f; font-size: 12px; line-height: 1.6; }
  </style>
  <div class="head">
    <div>
      <div class="org">${esc(input.orgName)}</div>
      <div class="org-meta">
        ${input.orgAddress ? esc(input.orgAddress) + "<br/>" : ""}
        ${input.orgLicense ? "License " + esc(input.orgLicense) : ""}
      </div>
    </div>
    <div class="doc">
      <div class="doc-type">${heading}</div>
      <div class="doc-num">${esc(input.docNumber)}</div>
      <div class="doc-dates">${dates}</div>
    </div>
  </div>
  <div class="meta">
    <div>
      <div class="label">PREPARED FOR</div>
      <div class="value">${esc(input.clientName)}</div>
      ${input.clientAddress ? `<div class="org-meta">${esc(input.clientAddress)}</div>` : ""}
    </div>
    <div style="text-align:right">
      <div class="label">PROJECT</div>
      <div class="value">${esc(input.jobTitle)}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>DESCRIPTION</th><th>QTY</th><th style="text-align:right">UNIT PRICE</th><th style="text-align:right">AMOUNT</th></tr>
    </thead>
    <tbody>
      ${KIND_ORDER.map((kind) => kindSection(kind, input.lines)).join("")}
    </tbody>
  </table>
  <table class="totals">
    <tr><td>Subtotal</td><td class="num">${m(input.subtotalCents)}</td></tr>
    ${taxRow}
    <tr class="grand"><td>Total</td><td class="num">${m(input.totalCents)}</td></tr>
  </table>
  ${input.notes ? `<div class="notes"><span class="label">NOTES</span><br/>${esc(input.notes)}</div>` : ""}
  ${input.terms ? `<div class="notes"><span class="label">TERMS</span><br/>${esc(input.terms)}</div>` : ""}
</div>`;
}
