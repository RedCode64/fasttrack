/**
 * Thin native wrapper around react-native-purchases (RevenueCat). Untested by
 * design — the decision logic lives in the pure `entitlement.ts`. Metro resolves
 * `purchasesClient.web.ts` on web, so this file's native import never loads there.
 */
import Purchases, { type CustomerInfo, type PurchasesPackage } from "react-native-purchases";

import { isProEntitlement } from "./entitlement";

/** The RevenueCat package type the paywall renders (has `.product.priceString`, `.packageType`). */
export type ProPackage = PurchasesPackage;

export async function configurePurchases(apiKey: string): Promise<void> {
  if (!apiKey) throw new Error("RevenueCat API key not configured");
  Purchases.configure({ apiKey });
}

export async function currentIsPro(): Promise<boolean> {
  return isProEntitlement(await Purchases.getCustomerInfo());
}

export async function getProPackages(): Promise<ProPackage[]> {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function purchaseProPackage(pkg: ProPackage): Promise<boolean> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return isProEntitlement(customerInfo);
}

export async function restorePro(): Promise<boolean> {
  return isProEntitlement(await Purchases.restorePurchases());
}

export function onCustomerInfo(cb: (isPro: boolean) => void): () => void {
  const listener = (info: CustomerInfo): void => cb(isProEntitlement(info));
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => Purchases.removeCustomerInfoUpdateListener(listener);
}
