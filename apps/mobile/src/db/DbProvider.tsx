import type { Organization } from "@fasttrack/schema";
import * as Crypto from "expo-crypto";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme";

import { defaultNow, type DbCtx } from "./driver";
import { migrate } from "./migrations";
import { openAppDriver } from "./openDriver";
import { getOrg } from "./repos/orgRepo";

interface DbValue {
  readonly ctx: DbCtx;
  readonly org: Organization | null;
  /** Bumped after every mutate(); useQuery re-runs on it. */
  readonly version: number;
  readonly mutate: <T>(fn: (ctx: DbCtx) => Promise<T>) => Promise<T>;
  /** Re-read the org row (after onboarding). */
  readonly refreshOrg: () => Promise<void>;
}

const DbContext = createContext<DbValue | null>(null);

export function DbProvider({ children }: { readonly children: ReactNode }) {
  const [ctx, setCtx] = useState<DbCtx | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const driver = await openAppDriver();
      await migrate(driver);
      const nextCtx: DbCtx = {
        driver,
        newId: () => Crypto.randomUUID(),
        now: defaultNow,
      };
      const currentOrg = await getOrg(nextCtx);
      if (!alive) return;
      setOrg(currentOrg);
      setCtx(nextCtx);
    })().catch((e: unknown) => {
      if (alive) setError(e instanceof Error ? e.message : "Database failed to open");
    });
    return () => {
      alive = false;
    };
  }, []);

  const mutate = useCallback(
    async <T,>(fn: (c: DbCtx) => Promise<T>): Promise<T> => {
      if (!ctx) throw new Error("Database not ready");
      const result = await fn(ctx);
      // Snapshot to durable storage on web (no-op on device/tests) so the
      // change survives a reload. A persist failure must not lose the result —
      // the mutation already landed in the live DB — so swallow it and still
      // bump the version to refresh the UI.
      try {
        await ctx.driver.persist?.();
      } catch {
        // best-effort durability; web preview only
      }
      setVersion((v) => v + 1);
      return result;
    },
    [ctx],
  );

  const refreshOrg = useCallback(async () => {
    if (!ctx) return;
    setOrg(await getOrg(ctx));
    setVersion((v) => v + 1);
  }, [ctx]);

  const value = useMemo(
    () => (ctx ? { ctx, org, version, mutate, refreshOrg } : null),
    [ctx, org, version, mutate, refreshOrg],
  );

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Something broke opening your data</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }
  if (!value) {
    return <View style={styles.center} />;
  }
  return <DbContext.Provider value={value}>{children}</DbContext.Provider>;
}

export function useDb(): DbValue {
  const value = useContext(DbContext);
  if (!value) throw new Error("useDb must be used inside DbProvider");
  return value;
}

interface QueryState<T> {
  readonly data: T | null;
  readonly error: string | null;
}

/**
 * Tiny local-data query hook: re-runs after any mutate() and when deps change.
 * `fn` is intentionally excluded from the effect deps — pass identifying
 * values through `deps` instead of memoizing callbacks at every call site.
 */
export function useQuery<T>(
  fn: (ctx: DbCtx) => Promise<T>,
  deps: readonly unknown[] = [],
): QueryState<T> {
  const { ctx, version } = useDb();
  const [state, setState] = useState<QueryState<T>>({ data: null, error: null });

  useEffect(() => {
    let alive = true;
    fn(ctx)
      .then((data) => {
        if (alive) setState({ data, error: null });
      })
      .catch((e: unknown) => {
        if (alive) setState({ data: null, error: e instanceof Error ? e.message : "Query failed" });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fn identity is unstable by design
  }, [ctx, version, ...deps]);

  return state;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.glowBase,
    padding: 24,
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  errorDetail: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
  },
});
