import { BASIS_POINTS_SCALE, cents, roundHalfUp, type BasisPoints, type Cents } from "./money.js";

/**
 * Applies a markup to a unit cost to produce the unit price a customer is charged.
 *
 * The result is snapshotted onto the line at write time and never recomputed:
 * price books and markups change, but a sent estimate must show the price as
 * sent, forever.
 */
export function priceFromCost(unitCost: Cents, markup: BasisPoints): Cents {
  if (markup < -BASIS_POINTS_SCALE) {
    throw new RangeError(
      `Markup below -100% produces a negative price: received ${markup} basis points`,
    );
  }
  return cents(roundHalfUp((unitCost * (BASIS_POINTS_SCALE + markup)) / BASIS_POINTS_SCALE));
}

/**
 * Extends a unit price across a quantity.
 *
 * Quantity is a float because trades bill in fractions — 2.5 hours, 13.75 feet.
 * The rounding here is load-bearing: it is what keeps float drift out of the
 * integer sums performed by documentTotals.
 */
export function lineTotal(unitPrice: Cents, quantity: number): Cents {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new RangeError(`Quantity must be a non-negative finite number, received ${quantity}`);
  }
  return cents(roundHalfUp(unitPrice * quantity));
}
