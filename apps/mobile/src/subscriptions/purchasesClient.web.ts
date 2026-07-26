/**
 * Web no-op stub for the RevenueCat wrapper. react-native-purchases has no web
 * runtime; on the web preview the app is always treated as free (packages empty,
 * purchase/restore no-op). Mirrors the openDriver.web.ts platform-split pattern.
 */

export interface ProPackage {
  readonly identifier: string;
  readonly packageType: string;
  readonly product: {
    readonly priceString: string;
    readonly title: string;
    readonly pricePerMonth: number | null;
    readonly pricePerMonthString: string | null;
  };
}

export async function configurePurchases(_apiKey: string): Promise<void> {
  /* no-op on web */
}

export async function currentIsPro(): Promise<boolean> {
  return false;
}

export async function getProPackages(): Promise<ProPackage[]> {
  return [];
}

export async function purchaseProPackage(_pkg: ProPackage): Promise<boolean> {
  return false;
}

export async function restorePro(): Promise<boolean> {
  return false;
}

export function onCustomerInfo(_cb: (isPro: boolean) => void): () => void {
  return () => {};
}
