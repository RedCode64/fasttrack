import { basisPoints, cents, type BasisPoints, type Cents } from "@fasttrack/core";
import { z } from "zod";

/** Integer cents, never negative. Brands to Cents so rows feed core math directly. */
export const centsField = z
  .number()
  .int()
  .min(0)
  .transform((n): Cents => cents(n));

/** Integer cents, strictly positive — payments and expenses can't be zero. */
export const positiveCentsField = z
  .number()
  .int()
  .min(1)
  .transform((n): Cents => cents(n));

/** Integer cents that may go negative (an overpaid invoice balance). */
export const signedCentsField = z
  .number()
  .int()
  .transform((n): Cents => cents(n));

/** Markup in basis points. -10000 (a 100% markdown) is the floor priceFromCost accepts. */
export const markupBpsField = z
  .number()
  .int()
  .min(-10_000)
  .transform((n): BasisPoints => basisPoints(n));

/** Non-negative rate in basis points (tax rates, target margins). */
export const rateBpsField = z
  .number()
  .int()
  .min(0)
  .transform((n): BasisPoints => basisPoints(n));

/** Quantities are floats — trades bill 2.5 hours, 13.75 feet. */
export const quantityField = z.number().finite().nonnegative();

export const uuidField = z.uuid();

/** Postgres timestamptz as Supabase returns it, e.g. 2026-07-16T12:34:56.789+00:00 */
export const timestampField = z.iso.datetime({ offset: true });

/** Calendar date, e.g. 2026-07-16 */
export const dateField = z.iso.date();

/**
 * Columns every synced row carries (spec §4 rules): created_at for stable list
 * ordering, updated_at for last-write-wins, deleted_at because hard deletes
 * do not sync.
 */
export const syncColumns = {
  created_at: timestampField,
  updated_at: timestampField,
  deleted_at: timestampField.nullable(),
};
