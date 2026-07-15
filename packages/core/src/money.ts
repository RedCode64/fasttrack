/** An integer count of cents. Never a float — see the spec's money rules. */
export type Cents = number & { readonly __cents: true };

/** An integer count of basis points. 2500 = 25.00%. */
export type BasisPoints = number & { readonly __basisPoints: true };

export const BASIS_POINTS_SCALE = 10_000;

export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Cents must be a safe integer, received ${value}`);
  }
  return value as Cents;
}

export function basisPoints(value: number): BasisPoints {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`BasisPoints must be a safe integer, received ${value}`);
  }
  return value as BasisPoints;
}

/**
 * Rounds half away from zero, normalizing -0 to 0.
 *
 * Math.round rounds half toward +Infinity (Math.round(-2.5) === -2), which is
 * wrong for money: a -2.5 cent adjustment owes -3, not -2.
 */
export function roundHalfUp(value: number): number {
  const rounded = Math.sign(value) * Math.round(Math.abs(value));
  return rounded === 0 ? 0 : rounded;
}
