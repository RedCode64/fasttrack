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
