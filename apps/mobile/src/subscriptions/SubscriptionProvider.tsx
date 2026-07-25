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
  /** Why `packages` is empty after `isReady` — e.g. RevenueCat rejected the API key, or the device is offline. */
  readonly error: string | null;
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      await configurePurchases(API_KEY);
      unsubscribe = onCustomerInfo(setIsPro);
      setIsPro(await currentIsPro());
      setPackages(await getProPackages());
    })()
      .catch((e: unknown) => {
        // Stay in the free state, but keep the real reason — a paywall that
        // silently loads forever is undiagnosable without a Mac to read device
        // console logs from, and looks identical to a reviewer whether it's a
        // transient network blip or a permanently broken API key.
        setError(e instanceof Error ? e.message : "Could not load subscription plans");
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
    () => ({ isPro, isReady, packages, error, purchase, restore }),
    [isPro, isReady, packages, error, purchase, restore],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useEntitlement(): SubscriptionValue {
  const value = useContext(SubscriptionContext);
  if (!value) throw new Error("useEntitlement must be used inside SubscriptionProvider");
  return value;
}
