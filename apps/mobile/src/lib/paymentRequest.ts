import { money, shortDate } from "./format";

/**
 * Everything the payment-request message needs — kept as a plain input so the
 * builder stays pure and unit-testable. `payLink` is the tradesperson's own
 * pay-me link (Venmo/Zelle/PayPal.me/Stripe), stored device-local in settings.
 */
export interface PaymentRequestInput {
  readonly businessName: string;
  readonly clientName: string;
  readonly invoiceNumber: number;
  readonly balanceCents: number;
  readonly dueAtIso: string | null;
  readonly isOverdue: boolean;
  readonly payLink?: string | null;
}

/**
 * Composes the plain-text message the tradesperson sends to get paid — the
 * thing Joist/Jobber automate and FastTrack was missing. Sent through the OS
 * share sheet, so it works over SMS, email, or WhatsApp. When a pay link is
 * set it becomes a real "pay online" prompt; without one it is still a polite,
 * specific reminder that beats "you around?".
 */
export function buildPaymentRequest(input: PaymentRequestInput): string {
  const amount = money(input.balanceCents, { showCents: true });
  const invoiceNo = `INV-${input.invoiceNumber}`;
  const lines: string[] = [`Hi ${input.clientName},`, ""];

  if (input.isOverdue) {
    const since = input.dueAtIso ? ` (due ${shortDate(input.dueAtIso)})` : "";
    lines.push(`A quick reminder that invoice ${invoiceNo} for ${amount} is now past due${since}.`);
  } else {
    const due = input.dueAtIso ? `, due ${shortDate(input.dueAtIso)}` : "";
    lines.push(`Here's invoice ${invoiceNo} for ${amount}${due}.`);
  }

  const link = input.payLink?.trim();
  if (link) {
    lines.push("", `Pay online: ${link}`);
  }

  lines.push("", "Thank you,", input.businessName);
  return lines.join("\n");
}
