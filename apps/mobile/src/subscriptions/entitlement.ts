/**
 * Pure entitlement rule, isolated from `react-native-purchases` so it unit-tests
 * in node. The native wrapper (`purchasesClient.ts`) feeds RevenueCat's real
 * `CustomerInfo` here — it structurally matches `EntitlementLike`.
 */

/** RevenueCat entitlement identifier that unlocks Pro. Must match the RevenueCat dashboard. */
export const PRO_ENTITLEMENT_ID = "pro";

export interface EntitlementLike {
  readonly entitlements: { readonly active: Readonly<Record<string, unknown>> };
}

export function isProEntitlement(info: EntitlementLike): boolean {
  return Object.prototype.hasOwnProperty.call(info.entitlements.active, PRO_ENTITLEMENT_ID);
}
