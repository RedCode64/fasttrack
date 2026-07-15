import { BASIS_POINTS_SCALE, cents, roundHalfUp, type BasisPoints, type Cents } from "./money.js";
import { lineTotal } from "./pricing.js";

export interface TotalsLine {
  readonly unitPriceCents: Cents;
  readonly quantity: number;
  readonly isTaxable: boolean;
}

export interface DocumentTotals {
  readonly subtotalCents: Cents;
  readonly discountCents: Cents;
  readonly taxCents: Cents;
  readonly totalCents: Cents;
}

/**
 * Computes the totals shown on an estimate or invoice.
 *
 * Each line is rounded to cents before it is summed, so the subtotal is an
 * exact integer sum rather than a float accumulation.
 */
export function documentTotals(
  lines: readonly TotalsLine[],
  discount: Cents,
  taxRate: BasisPoints,
): DocumentTotals {
  let subtotal = 0;
  let taxableSubtotal = 0;

  for (const line of lines) {
    const total = lineTotal(line.unitPriceCents, line.quantity);
    subtotal += total;
    if (line.isTaxable) {
      taxableSubtotal += total;
    }
  }

  if (discount < 0) {
    throw new RangeError(`Discount must be non-negative, received ${discount}`);
  }
  if (discount > subtotal) {
    throw new RangeError(`Discount ${discount} exceeds subtotal ${subtotal}`);
  }

  // The discount comes off the taxable base in proportion to how much of the
  // document is taxable — otherwise the customer pays tax on money they didn't
  // spend. An empty document has a zero subtotal, so guard the divide.
  const taxableDiscount =
    subtotal === 0 ? 0 : roundHalfUp((discount * taxableSubtotal) / subtotal);
  const discountedTaxableBase = taxableSubtotal - taxableDiscount;
  const tax = roundHalfUp((discountedTaxableBase * taxRate) / BASIS_POINTS_SCALE);

  return {
    subtotalCents: cents(subtotal),
    discountCents: discount,
    taxCents: cents(tax),
    totalCents: cents(subtotal - discount + tax),
  };
}
