import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  configurePurchases,
  currentIsPro,
  getProPackages,
  onCustomerInfo,
  purchaseProPackage,
  restorePro,
  type ProPackage,
} from "./purchasesClient";

interface SubscriptionValue {
  readonly isPro: boolean;
  readonly isReady: boolean;
  readonly packages: readonly ProPackage[];
  readonly purchase: (pkg: ProPackage) => Promise<void>;
  readonly restore: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionValue | null>(null);

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";

/**
 * Configures RevenueCat once, then exposes live entitlement + offerings. Any
 * failure (web, offline, missing key) leaves the app in the free state without
 * crashing — gates simply route to the paywall.
 */
export function SubscriptionProvider({ children }: { readonly children: ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [packages, setPackages] = useState<readonly ProPackage[]>([]);

  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      await configurePurchases(API_KEY);
      unsubscribe = onCustomerInfo(setIsPro);
      setIsPro(await currentIsPro());
      setPackages(await getProPackages());
    })()
      .catch(() => {
        /* stay free on any configure/fetch failure */
      })
      .finally(() => setIsReady(true));
    return () => unsubscribe();
  }, []);

  const purchase = useCallback(async (pkg: ProPackage) => {
    setIsPro(await purchaseProPackage(pkg));
  }, []);

  const restore = useCallback(async () => {
    setIsPro(await restorePro());
  }, []);

  const value = useMemo<SubscriptionValue>(
    () => ({ isPro, isReady, packages, purchase, restore }),
    [isPro, isReady, packages, purchase, restore],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useEntitlement(): SubscriptionValue {
  const value = useContext(SubscriptionContext);
  if (!value) throw new Error("useEntitlement must be used inside SubscriptionProvider");
  return value;
}
