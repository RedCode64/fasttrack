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

/** One recorded payment, already display-formatted by the caller (no cost/markup here). */
export interface PdfPayment {
  readonly method: string;
  readonly paidAt: string;
  readonly reference: string | null;
  readonly amountCents: Cents;
}

export type PdfDocType = "estimate" | "invoice" | "receipt";

export interface PdfDocumentInput {
  readonly docType: PdfDocType;
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
  /** Present on invoices/receipts that have taken money — drives the payments block. */
  readonly payments?: readonly PdfPayment[];
  /** Outstanding balance in cents; when set, the totals show Amount paid + Balance due. */
  readonly balanceCents?: number | null;
  /** Free-tier flag: when true, a print-safe "Made with FastTrack" footer is rendered. */
  readonly watermark?: boolean;
}

const DOC_TYPE_LABEL: Record<PdfDocType, string> = {
  estimate: "Estimate",
  invoice: "Invoice",
  receipt: "Receipt",
};

/**
 * What the shared file is called, e.g. `Invoice INV-1042 Novak.pdf`.
 *
 * The printer hands back a temp file on a generated path, so without this the
 * client receives something like `2a7f9c1e-...pdf` in their mail app. Anything
 * a filesystem or share target could choke on is folded to a space — client
 * names are free text and routinely contain `/` or `:`.
 */
export function documentFileName(input: PdfDocumentInput): string {
  const label = `${DOC_TYPE_LABEL[input.docType]} ${input.docNumber} ${input.clientName}`;
  const cleaned = label
    .replace(/[/\\?%*:|"<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${cleaned.length > 0 ? cleaned : "Document"}.pdf`;
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

const HEADINGS: Record<PdfDocType, string> = {
  estimate: "ESTIMATE",
  invoice: "INVOICE",
  receipt: "RECEIPT",
};

function paymentRow(payment: PdfPayment): string {
  const ref = payment.reference ? ` · ${esc(payment.reference)}` : "";
  return `
    <tr>
      <td class="pay-method">${esc(payment.method)}${ref}</td>
      <td class="pay-date">Paid ${shortDate(payment.paidAt)}</td>
      <td class="num">${m(payment.amountCents)}</td>
    </tr>`;
}

const INTRO: Record<PdfDocType, string> = {
  estimate: "Estimate prepared for your review.",
  invoice: "Please remit payment by the due date below.",
  receipt: "This confirms the payment(s) received. Thank you.",
};

/**
 * A complete, print-ready HTML document (not a fragment) styled like a real
 * invoice/receipt. Uses only print-safe CSS — solid fills and borders, table
 * layout, an @page box — so print engines emit crisp vector text instead of
 * rasterising the page (which produced the tiled-image PDFs this replaced).
 */
export function buildDocumentHtml(input: PdfDocumentInput): string {
  const heading = HEADINGS[input.docType];
  const isReceipt = input.docType === "receipt";
  const billLabel = input.docType === "estimate" ? "Prepared for" : "Bill to";
  const dates = [
    input.issuedAt ? `Issued ${shortDate(input.issuedAt)}` : null,
    input.dueAt && !isReceipt ? `Due ${shortDate(input.dueAt)}` : null,
  ]
    .filter((d): d is string => d !== null)
    .join(" &middot; ");

  const taxRow =
    input.taxCents > 0
      ? `<tr><td>${esc(input.taxName)} (${taxRateLabel(input.taxRateBps)})</td><td class="num">${m(input.taxCents)}</td></tr>`
      : "";

  const payments = input.payments ?? [];
  const hasPayments = payments.length > 0;
  const amountPaidCents = payments.reduce((sum, p) => sum + p.amountCents, 0);
  const balanceCents = input.balanceCents ?? input.totalCents - amountPaidCents;

  const paidRows = hasPayments
    ? `
    <tr class="paid"><td>Amount paid</td><td class="num">-${m(amountPaidCents)}</td></tr>
    <tr class="balance"><td>Balance due</td><td class="num">${m(balanceCents)}</td></tr>`
    : "";

  const stamp = isReceipt ? `<span class="badge">PAID</span>` : "";

  const paymentsSection = hasPayments
    ? `
    <div class="pay-label">PAYMENTS</div>
    <table class="pay"><tbody>${payments.map(paymentRow).join("")}</tbody></table>`
    : "";

  const notes = [
    input.notes ? { label: "Notes", body: input.notes } : null,
    input.terms ? { label: "Terms", body: input.terms } : null,
  ].filter((n): n is { label: string; body: string } => n !== null);

  const notesBlock = notes
    .map((n) => `<div class="note"><span class="note-label">${n.label}</span>${esc(n.body)}</div>`)
    .join("");

  const closing = isReceipt
    ? "Payment received — thank you for your business."
    : "Thank you for your business.";

  const watermarkBlock = input.watermark
    ? `<div class="watermark">Made with FastTrack</div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(heading)} ${esc(input.docNumber)}</title>
<style>
  @page { size: Letter; margin: 0.5in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
         color: #1c2622; font-size: 12.5px; line-height: 1.45;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc-type { font-size: 11px; letter-spacing: 3px; color: #1c7c4e; font-weight: 800; }
  .head { width: 100%; border-collapse: collapse; }
  .head td { vertical-align: top; padding: 0; }
  .brand-name { font-size: 22px; font-weight: 800; letter-spacing: -0.4px; color: #14231b; }
  .brand-meta { color: #6b756e; font-size: 11px; margin-top: 5px; line-height: 1.5; }
  .doc-cell { text-align: right; white-space: nowrap; }
  .doc-num { font-size: 20px; font-weight: 800; margin-top: 2px; }
  .doc-dates { color: #6b756e; font-size: 11px; margin-top: 5px; }
  .badge { display: inline-block; margin-top: 9px; border: 2px solid #1c7c4e;
           background: #eef7f1; color: #146c43; font-size: 13px; font-weight: 800;
           letter-spacing: 2.5px; padding: 4px 13px; border-radius: 5px; }
  .accent { height: 3px; background: #1c7c4e; border-radius: 2px; margin: 15px 0 0; }
  .intro { color: #6b756e; font-size: 11.5px; margin-top: 14px; }
  .parties { width: 100%; border-collapse: collapse; margin-top: 16px; }
  .parties td { vertical-align: top; padding: 0; }
  .parties .right { text-align: right; }
  .label { font-size: 9.5px; letter-spacing: 1.5px; color: #9aa39c; font-weight: 800;
           text-transform: uppercase; }
  .party-name { margin-top: 4px; font-weight: 700; font-size: 13.5px; }
  .party-sub { color: #6b756e; font-size: 11px; margin-top: 2px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 22px; }
  table.items th { text-align: left; font-size: 9.5px; letter-spacing: 1px; color: #9aa39c;
                   border-bottom: 1.5px solid #1c2622; padding: 0 6px 7px; text-transform: uppercase; }
  table.items td { padding: 8px 6px; border-bottom: 1px solid #eef1ec; vertical-align: top; }
  tr.group td { font-weight: 800; color: #1c7c4e; font-size: 10px; letter-spacing: 1px;
                padding-top: 15px; border-bottom: none; text-transform: uppercase; }
  .qty { color: #6b756e; white-space: nowrap; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .summary { width: 100%; border-collapse: collapse; margin-top: 16px; }
  .summary > tbody > tr > td { padding: 0; vertical-align: top; }
  table.totals { width: 58%; margin-left: auto; border-collapse: collapse; }
  table.totals td { padding: 4px 6px; }
  table.totals .grand td { border-top: 2px solid #1c2622; font-weight: 800; font-size: 15px;
                           padding-top: 8px; }
  table.totals .paid td { color: #1c7c4e; font-weight: 600; }
  table.totals .balance td { border-top: 1px solid #cfd7cf; font-weight: 800; font-size: 14px;
                             padding-top: 6px; }
  .pay-label { font-size: 9.5px; letter-spacing: 1.5px; color: #9aa39c; font-weight: 800;
               margin-top: 26px; text-transform: uppercase; }
  table.pay { width: 100%; border-collapse: collapse; margin-top: 6px; }
  table.pay td { padding: 7px 6px; border-bottom: 1px solid #eef1ec; font-size: 12px;
                 vertical-align: top; }
  .pay-method { font-weight: 600; }
  .pay-date { color: #6b756e; white-space: nowrap; text-align: right; }
  .footer { margin-top: 26px; border-top: 1px solid #eef1ec; padding-top: 14px; }
  .note { color: #5c665f; font-size: 11.5px; line-height: 1.55; margin-top: 8px; }
  .note-label { display: block; font-size: 9.5px; letter-spacing: 1.5px; color: #9aa39c;
                font-weight: 800; text-transform: uppercase; margin-bottom: 2px; }
  .closing { color: #146c43; font-weight: 700; font-size: 12.5px; margin-top: 16px; }
  .watermark { margin-top: 20px; padding-top: 12px; border-top: 1px solid #eef1ec;
               text-align: center; font-size: 9.5px; letter-spacing: 2px; color: #b3bab4;
               font-weight: 700; text-transform: uppercase; }
</style>
</head>
<body>
  <table class="head"><tbody><tr>
    <td>
      <div class="brand-name">${esc(input.orgName)}</div>
      <div class="brand-meta">
        ${input.orgAddress ? esc(input.orgAddress) + "<br/>" : ""}
        ${input.orgLicense ? "License " + esc(input.orgLicense) : ""}
      </div>
    </td>
    <td class="doc-cell">
      <div class="doc-type">${heading}</div>
      <div class="doc-num">${esc(input.docNumber)}</div>
      <div class="doc-dates">${dates}</div>
      ${stamp}
    </td>
  </tr></tbody></table>
  <div class="accent"></div>
  <div class="intro">${INTRO[input.docType]}</div>

  <table class="parties"><tbody><tr>
    <td>
      <div class="label">${billLabel}</div>
      <div class="party-name">${esc(input.clientName)}</div>
      ${input.clientAddress ? `<div class="party-sub">${esc(input.clientAddress)}</div>` : ""}
    </td>
    <td class="right">
      <div class="label">Project</div>
      <div class="party-name">${esc(input.jobTitle)}</div>
    </td>
  </tr></tbody></table>

  <table class="items">
    <thead>
      <tr><th>Description</th><th>Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr>
    </thead>
    <tbody>
      ${KIND_ORDER.map((kind) => kindSection(kind, input.lines)).join("")}
    </tbody>
  </table>

  <table class="summary"><tbody><tr><td>
    <table class="totals"><tbody>
      <tr><td>Subtotal</td><td class="num">${m(input.subtotalCents)}</td></tr>
      ${taxRow}
      <tr class="grand"><td>Total</td><td class="num">${m(input.totalCents)}</td></tr>
      ${paidRows}
    </tbody></table>
  </td></tr></tbody></table>
  ${paymentsSection}

  <div class="footer">
    <div class="closing">${closing}</div>
    ${notesBlock}
  </div>
  ${watermarkBlock}
</body>
</html>`;
}
