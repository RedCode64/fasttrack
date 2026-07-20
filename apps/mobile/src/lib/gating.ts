/**
 * Freemium gating — pure predicates the UI consults before creating a capped
 * resource or using a Pro-only feature. Dependency-free so it unit-tests under
 * vitest without the native purchases module. See the paywall in
 * `src/app/paywall.tsx` and the entitlement source in `src/subscriptions`.
 */

/** Free plan may hold at most this many clients. */
export const FREE_CLIENT_CAP = 3;
/** Free plan may hold at most this many documents (estimates + invoices combined). */
export const FREE_DOCUMENT_CAP = 5;

export function canAddClient(currentCount: number, isPro: boolean): boolean {
  return isPro || currentCount < FREE_CLIENT_CAP;
}

export function canAddDocument(currentCount: number, isPro: boolean): boolean {
  return isPro || currentCount < FREE_DOCUMENT_CAP;
}

export function canSync(isPro: boolean): boolean {
  return isPro;
}
