/**
 * Freemium gating — pure predicates the UI consults before creating a capped
 * resource or using a Pro-only feature. Dependency-free so it unit-tests under
 * vitest without the native purchases module. See the paywall in
 * `src/app/paywall.tsx` and the entitlement source in `src/subscriptions`.
 */

/** Free plan may hold at most this many clients. */
export const FREE_CLIENT_CAP = 5;
/**
 * Free plan may hold at most this many documents (estimates + invoices
 * combined) — two per free client, so the plan covers one full
 * estimate-then-invoice cycle for every client it allows.
 */
export const FREE_DOCUMENT_CAP = 10;

export function canAddClient(currentCount: number, isPro: boolean): boolean {
  return isPro || currentCount < FREE_CLIENT_CAP;
}

export function canAddDocument(currentCount: number, isPro: boolean): boolean {
  return isPro || currentCount < FREE_DOCUMENT_CAP;
}

export function canSync(isPro: boolean): boolean {
  return isPro;
}

/**
 * How close a free user is to a cap:
 *  - `ok`       → nothing to say
 *  - `last`     → this is the final free one, worth a gentle heads-up
 *  - `reached`  → the next create is blocked
 */
export type CapState = "ok" | "last" | "reached";

/**
 * Drives the *warning* a screen shows before the user invests effort in a
 * form. It never gates anything — `canAddClient` / `canAddDocument` remain the
 * enforcement — so a bug here can only ever mis-word a notice, never let a
 * free user past a cap.
 */
export function capState(currentCount: number, cap: number, isPro: boolean): CapState {
  if (isPro) return "ok";
  if (currentCount >= cap) return "reached";
  return currentCount === cap - 1 ? "last" : "ok";
}

export interface CapWarning {
  readonly kind: "client" | "document";
  readonly state: Exclude<CapState, "ok">;
}

export interface CreateDocumentInput {
  /** False when picking an existing client, which costs nothing against the client cap. */
  readonly createsNewClient: boolean;
  readonly clientCount: number;
  readonly documentCount: number;
  readonly isPro: boolean;
}

/**
 * The single warning to show before creating a document — creating one can
 * cross either cap, and showing both at once is noise. A blocking cap always
 * wins over a last-one heads-up, so the notice never promises a create that
 * `canAddClient` / `canAddDocument` would refuse.
 */
export function createDocumentWarning(input: CreateDocumentInput): CapWarning | null {
  const { createsNewClient, clientCount, documentCount, isPro } = input;

  const candidates: readonly CapWarning[] = [
    {
      kind: "client",
      state: createsNewClient ? capState(clientCount, FREE_CLIENT_CAP, isPro) : "ok",
    },
    { kind: "document", state: capState(documentCount, FREE_DOCUMENT_CAP, isPro) },
  ].filter((c): c is CapWarning => c.state !== "ok");

  return candidates.find((c) => c.state === "reached") ?? candidates[0] ?? null;
}
