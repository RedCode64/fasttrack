import type { Organization } from "@fasttrack/schema";

import type { EstimateDetail } from "@/db/repos/estimateRepo";
import type { InvoiceDetail } from "@/db/repos/invoiceRepo";

import { docNumber } from "./format";
import type { PdfDocumentInput, PdfLine } from "./pdf";

/** Repo detail payloads → the prices-only PDF input (decision 8). */

interface DocLineLike {
  readonly kind: PdfLine["kind"];
  readonly description: string;
  readonly quantity: number;
  readonly unit: string;
  readonly unit_price_cents: PdfLine["unitPriceCents"];
}

function toPdfLines(lines: readonly DocLineLike[]): PdfLine[] {
  return lines.map((l) => ({
    kind: l.kind,
    description: l.description,
    quantity: l.quantity,
    unit: l.unit,
    unitPriceCents: l.unit_price_cents,
  }));
}

export function estimatePdfInput(org: Organization, detail: EstimateDetail): PdfDocumentInput {
  return {
    docType: "estimate",
    docNumber: docNumber("EST", detail.estimate.number),
    orgName: org.name,
    orgAddress: org.address,
    orgLicense: org.license_no,
    clientName: detail.client.name,
    clientAddress: detail.client.address,
    jobTitle: detail.job.title,
    issuedAt: detail.estimate.issued_at,
    dueAt: null,
    subtotalCents: detail.estimate.subtotal_cents,
    taxCents: detail.estimate.tax_cents,
    totalCents: detail.estimate.total_cents,
    taxName: org.tax_config.name,
    taxRateBps: org.tax_config.rate_bps,
    notes: detail.estimate.notes,
    terms: detail.estimate.terms,
    lines: toPdfLines(detail.lines),
  };
}

export function invoicePdfInput(org: Organization, detail: InvoiceDetail): PdfDocumentInput {
  return {
    docType: "invoice",
    docNumber: docNumber("INV", detail.invoice.number),
    orgName: org.name,
    orgAddress: org.address,
    orgLicense: org.license_no,
    clientName: detail.client.name,
    clientAddress: detail.client.address,
    jobTitle: detail.job.title,
    issuedAt: detail.invoice.issued_at,
    dueAt: detail.invoice.due_at,
    subtotalCents: detail.invoice.subtotal_cents,
    taxCents: detail.invoice.tax_cents,
    totalCents: detail.invoice.total_cents,
    taxName: org.tax_config.name,
    taxRateBps: org.tax_config.rate_bps,
    notes: detail.invoice.notes,
    terms: detail.invoice.terms,
    lines: toPdfLines(detail.lines),
  };
}
