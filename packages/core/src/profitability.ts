import {
  BASIS_POINTS_SCALE,
  basisPoints,
  cents,
  roundHalfUp,
  type BasisPoints,
  type Cents,
} from "./money.js";
import { lineTotal } from "./pricing.js";

export interface ProfitLine {
  readonly unitCostCents: Cents;
  readonly unitPriceCents: Cents;
  readonly quantity: number;
}

export interface DocumentProfit {
  readonly costCents: Cents;
  readonly revenueCents: Cents;
  readonly profitCents: Cents;
  readonly marginBps: BasisPoints;
}

/**
 * Computes what a document earns: cost, revenue, profit, and margin.
 *
 * Margin is profit ÷ revenue (not markup-on-cost), in basis points. Revenue is
 * the pre-tax, post-discount subtotal — tax passes through to the state and is
 * nobody's profit. A zero-revenue document has zero margin, never NaN.
 */
export function documentProfit(lines: readonly ProfitLine[], discount: Cents): DocumentProfit {
  let cost = 0;
  let subtotal = 0;
  for (const line of lines) {
    cost += lineTotal(line.unitCostCents, line.quantity);
    subtotal += lineTotal(line.unitPriceCents, line.quantity);
  }

  if (discount < 0) {
    throw new RangeError(`Discount must be non-negative, received ${discount}`);
  }
  if (discount > subtotal) {
    throw new RangeError(`Discount ${discount} exceeds subtotal ${subtotal}`);
  }

  const revenue = subtotal - discount;
  const profit = revenue - cost;
  const margin = revenue === 0 ? 0 : roundHalfUp((profit * BASIS_POINTS_SCALE) / revenue);

  return {
    costCents: cents(cost),
    revenueCents: cents(revenue),
    profitCents: cents(profit),
    marginBps: basisPoints(margin),
  };
}
