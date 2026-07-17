/** Text-input → integer money/rate parsing (fail-soft: null on junk). */

/** "412", "412.5", "412.50" → 41250-style integer cents; null when unparseable. */
export function dollarsToCents(text: string): number | null {
  const value = Number.parseFloat(text.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** "30" or "8.25" (percent) → 3000 / 825 bps; null when unparseable. */
export function pctToBps(text: string): number | null {
  const value = Number.parseFloat(text.replace(/[%\s]/g, ""));
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** "2", "2.5" → quantity number ≥ 0; null when unparseable. */
export function parseQuantity(text: string): number | null {
  const value = Number.parseFloat(text);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}
