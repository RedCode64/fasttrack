# FastTrack iOS App Store Readiness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the FastTrack Expo/React Native iOS app pass Apple App Store review — ship a freemium in-app subscription (RevenueCat) plus all release configuration, privacy surfaces, store metadata, and an owner runbook.

**Architecture:** Two workstreams. (B) Subscriptions: a pure gating layer (`gating.ts`) + a pure entitlement decoder (`entitlement.ts`) + a platform-split RevenueCat wrapper (`purchasesClient.ts` / `.web.ts`, mirroring the existing `openDriver` split) + a `SubscriptionProvider` context + a `/paywall` screen, with gates wired at the three creation/feature points and a watermark threaded through the pure PDF builder. (A) Release: `app.json` iOS config, `eas.json`, public `/privacy` + `/support` routes in the Next.js web app, and drafted store metadata + runbook under `docs/appstore/`.

**Tech Stack:** Expo SDK 57, React Native 0.86, React 19, expo-router, TypeScript, vitest, `react-native-purchases` (RevenueCat), Next.js 15 (web), EAS Build/Submit.

**Standing rule (from `apps/mobile/AGENTS.md`):** Expo v57 changed APIs — before writing any Expo/native code, confirm against https://docs.expo.dev/versions/v57.0.0/ and RevenueCat's current Expo guide (https://www.revenuecat.com/docs/getting-started/installation/expo). Where this plan gives exact code, verify the import/config surface still matches; the RevenueCat runtime API used here (`Purchases.configure`, `getOfferings`, `purchasePackage`, `restorePurchases`, `getCustomerInfo`, `addCustomerInfoUpdateListener`) is stable across recent majors.

**Commands (run from `apps/mobile/` unless noted):**
- Single test file: `pnpm vitest run src/lib/gating.test.ts`
- Mobile test + typecheck: `pnpm test` / `pnpm typecheck`
- Whole workspace (from repo root `C:/Users/pagan/Claude/App`): `pnpm test` / `pnpm typecheck`

---

## File Structure

**Workstream B — Subscriptions (mobile, `apps/mobile/`):**
- Create `src/lib/gating.ts` — pure freemium predicates + cap constants.
- Create `src/lib/gating.test.ts` — unit tests.
- Create `src/subscriptions/entitlement.ts` — pure `isProEntitlement()` decoder (no native import).
- Create `src/subscriptions/entitlement.test.ts` — unit tests.
- Create `src/subscriptions/purchasesClient.ts` — native RevenueCat wrapper (thin, untested by design like `printPdf.ts`).
- Create `src/subscriptions/purchasesClient.web.ts` — web no-op stub.
- Create `src/subscriptions/SubscriptionProvider.tsx` — context + `useEntitlement()`.
- Create `src/app/paywall.tsx` — the paywall screen (route `/paywall`).
- Modify `src/lib/pdf.ts` — add `watermark?` to input + render block.
- Modify `src/lib/pdf.test.ts` — watermark cases.
- Modify `src/lib/docPdf.ts` — thread `isPro` → `watermark`.
- Modify `src/app/_layout.tsx` — mount `SubscriptionProvider`.
- Modify `src/app/estimate/new.tsx` — client + document gates.
- Modify `src/app/estimate/[id]/index.tsx` — convert gate + PDF `isPro`.
- Modify `src/app/invoice/[id].tsx` — PDF `isPro`.
- Modify `src/app/sync.tsx` — sync gate.
- Modify `package.json` — add `react-native-purchases`.
- Modify `.env.example` — add RevenueCat + web URL keys.

**Workstream A — Release (mobile + web + docs):**
- Modify `apps/mobile/app.json` — iOS release config.
- Create `apps/mobile/eas.json` — build/submit profiles.
- Create `apps/web/src/app/privacy/page.tsx` — privacy policy.
- Create `apps/web/src/app/support/page.tsx` — support page.
- Create `docs/appstore/metadata.md`, `docs/appstore/app-privacy.md`, `docs/appstore/screenshots.md`, `docs/appstore/RUNBOOK.md`.

---

## Task 1: Freemium gating predicates (pure, TDD)

**Files:**
- Create: `apps/mobile/src/lib/gating.ts`
- Test: `apps/mobile/src/lib/gating.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/lib/gating.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  canAddClient,
  canAddDocument,
  canSync,
  FREE_CLIENT_CAP,
  FREE_DOCUMENT_CAP,
} from "./gating";

describe("canAddClient", () => {
  it("allows a free user below the cap", () => {
    expect(canAddClient(FREE_CLIENT_CAP - 1, false)).toBe(true);
  });
  it("blocks a free user at the cap", () => {
    expect(canAddClient(FREE_CLIENT_CAP, false)).toBe(false);
  });
  it("allows a Pro user past the cap", () => {
    expect(canAddClient(FREE_CLIENT_CAP + 50, true)).toBe(true);
  });
});

describe("canAddDocument", () => {
  it("allows a free user below the cap", () => {
    expect(canAddDocument(FREE_DOCUMENT_CAP - 1, false)).toBe(true);
  });
  it("blocks a free user at the cap", () => {
    expect(canAddDocument(FREE_DOCUMENT_CAP, false)).toBe(false);
  });
  it("allows a Pro user past the cap", () => {
    expect(canAddDocument(FREE_DOCUMENT_CAP + 50, true)).toBe(true);
  });
});

describe("canSync", () => {
  it("blocks free users", () => {
    expect(canSync(false)).toBe(false);
  });
  it("allows Pro users", () => {
    expect(canSync(true)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/gating.test.ts`
Expected: FAIL — cannot resolve `./gating`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/mobile/src/lib/gating.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/gating.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/pagan/Claude/App"
git add apps/mobile/src/lib/gating.ts apps/mobile/src/lib/gating.test.ts
git commit -m "feat(mobile): pure freemium gating predicates (client/document caps, sync)"
```

---

## Task 2: Entitlement decoder (pure, TDD)

Separates the "is this customer Pro?" rule from the native SDK so it is unit-testable. RevenueCat's `CustomerInfo` structurally satisfies `EntitlementLike` (it has `entitlements.active`), so the native wrapper passes its real object straight in.

**Files:**
- Create: `apps/mobile/src/subscriptions/entitlement.ts`
- Test: `apps/mobile/src/subscriptions/entitlement.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/subscriptions/entitlement.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { isProEntitlement, PRO_ENTITLEMENT_ID } from "./entitlement";

describe("isProEntitlement", () => {
  it("is true when the pro entitlement is active", () => {
    const info = { entitlements: { active: { [PRO_ENTITLEMENT_ID]: { isActive: true } } } };
    expect(isProEntitlement(info)).toBe(true);
  });
  it("is false when no entitlements are active", () => {
    expect(isProEntitlement({ entitlements: { active: {} } })).toBe(false);
  });
  it("is false when only a different entitlement is active", () => {
    expect(isProEntitlement({ entitlements: { active: { other: {} } } })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/subscriptions/entitlement.test.ts`
Expected: FAIL — cannot resolve `./entitlement`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/mobile/src/subscriptions/entitlement.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/subscriptions/entitlement.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/pagan/Claude/App"
git add apps/mobile/src/subscriptions/entitlement.ts apps/mobile/src/subscriptions/entitlement.test.ts
git commit -m "feat(mobile): pure RevenueCat entitlement decoder"
```

---

## Task 3: PDF watermark for free tier (pure, TDD)

Adds an optional, print-safe footer watermark to the pure HTML builder, then threads `isPro` through the `docPdf.ts` mappers. **Print-safe constraint:** the watermark is a plain block — **no CSS transforms/rotation** — because transforms make print engines rasterize the whole page into blurry tiles (documented in project memory `fasttrack-pdf-rendering`).

**Files:**
- Modify: `apps/mobile/src/lib/pdf.ts`
- Modify: `apps/mobile/src/lib/pdf.test.ts`
- Modify: `apps/mobile/src/lib/docPdf.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/mobile/src/lib/pdf.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildDocumentHtml, type PdfDocumentInput } from "./pdf";

const baseInput: PdfDocumentInput = {
  docType: "estimate",
  docNumber: "EST-0001",
  orgName: "Acme Electric",
  orgAddress: null,
  orgLicense: null,
  clientName: "Novak",
  clientAddress: null,
  jobTitle: "Panel upgrade",
  issuedAt: null,
  dueAt: null,
  subtotalCents: 10000,
  taxCents: 0,
  totalCents: 10000,
  taxName: "Tax",
  taxRateBps: 0,
  notes: null,
  terms: null,
  lines: [],
};

describe("buildDocumentHtml watermark", () => {
  it("renders the free-tier watermark when watermark is true", () => {
    const html = buildDocumentHtml({ ...baseInput, watermark: true });
    expect(html).toContain("Made with FastTrack");
    expect(html).not.toContain("transform:");
  });
  it("omits the watermark when watermark is false or unset", () => {
    expect(buildDocumentHtml({ ...baseInput, watermark: false })).not.toContain("Made with FastTrack");
    expect(buildDocumentHtml(baseInput)).not.toContain("Made with FastTrack");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/pdf.test.ts`
Expected: FAIL — `watermark` is not a known property of `PdfDocumentInput` (type error) / "Made with FastTrack" not found.

- [ ] **Step 3: Add the `watermark` field to the input type**

In `apps/mobile/src/lib/pdf.ts`, inside `PdfDocumentInput`, add the field after `balanceCents`:

```ts
  /** Outstanding balance in cents; when set, the totals show Amount paid + Balance due. */
  readonly balanceCents?: number | null;
  /** Free-tier flag: when true, a print-safe "Made with FastTrack" footer is rendered. */
  readonly watermark?: boolean;
}
```

- [ ] **Step 4: Add the watermark CSS**

In `apps/mobile/src/lib/pdf.ts`, add this rule inside the `<style>` block, right after the `.closing` rule (near line 237):

```css
  .watermark { margin-top: 20px; padding-top: 12px; border-top: 1px solid #eef1ec;
               text-align: center; font-size: 9.5px; letter-spacing: 2px; color: #b3bab4;
               font-weight: 700; text-transform: uppercase; }
```

- [ ] **Step 5: Render the watermark block**

In `apps/mobile/src/lib/pdf.ts`, inside `buildDocumentHtml`, just before the final `return`, add:

```ts
  const watermarkBlock = input.watermark
    ? `<div class="watermark">Made with FastTrack</div>`
    : "";
```

Then in the returned template, change the footer close from:

```html
  <div class="footer">
    <div class="closing">${closing}</div>
    ${notesBlock}
  </div>
</body>
```

to:

```html
  <div class="footer">
    <div class="closing">${closing}</div>
    ${notesBlock}
  </div>
  ${watermarkBlock}
</body>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run src/lib/pdf.test.ts`
Expected: PASS (existing tests + 2 new).

- [ ] **Step 7: Thread `isPro` through the mappers**

In `apps/mobile/src/lib/docPdf.ts`, update the three exported mappers and the shared helper to accept `isPro` and set `watermark: !isPro`.

Change `invoiceLikeInput` signature and return:

```ts
function invoiceLikeInput(
  org: Organization,
  detail: InvoiceDetail,
  docType: "invoice" | "receipt",
  isPro: boolean,
): PdfDocumentInput {
  return {
    docType,
    docNumber: docNumber("INV", detail.invoice.number),
    orgName: org.name,
    orgAddress: org.address,
    orgLicense: org.license_no,
    clientName: detail.client.name,
    clientAddress: detail.client.address,
    jobTitle: detail.job.title,
    issuedAt: detail.invoice.issued_at,
    dueAt: detail.invoice.due_at,
    subtotalCents: detail.invoice.subtotal_cents,
    taxCents: detail.invoice.tax_cents,
    totalCents: detail.invoice.total_cents,
    taxName: org.tax_config.name,
    taxRateBps: org.tax_config.rate_bps,
    notes: detail.invoice.notes,
    terms: detail.invoice.terms,
    lines: toPdfLines(detail.lines),
    payments: toPdfPayments(detail.payments),
    balanceCents: detail.invoice.balance_cents,
    watermark: !isPro,
  };
}

export function estimatePdfInput(
  org: Organization,
  detail: EstimateDetail,
  isPro: boolean,
): PdfDocumentInput {
  return {
    docType: "estimate",
    docNumber: docNumber("EST", detail.estimate.number),
    orgName: org.name,
    orgAddress: org.address,
    orgLicense: org.license_no,
    clientName: detail.client.name,
    clientAddress: detail.client.address,
    jobTitle: detail.job.title,
    issuedAt: detail.estimate.issued_at,
    dueAt: null,
    subtotalCents: detail.estimate.subtotal_cents,
    taxCents: detail.estimate.tax_cents,
    totalCents: detail.estimate.total_cents,
    taxName: org.tax_config.name,
    taxRateBps: org.tax_config.rate_bps,
    notes: detail.estimate.notes,
    terms: detail.estimate.terms,
    lines: toPdfLines(detail.lines),
    watermark: !isPro,
  };
}

/** Invoice PDF: shows payments + remaining balance when money has been taken. */
export function invoicePdfInput(
  org: Organization,
  detail: InvoiceDetail,
  isPro: boolean,
): PdfDocumentInput {
  return invoiceLikeInput(org, detail, "invoice", isPro);
}

/** Receipt PDF: same body as the invoice, plus the RECEIPT heading + PAID stamp. */
export function receiptPdfInput(
  org: Organization,
  detail: InvoiceDetail,
  isPro: boolean,
): PdfDocumentInput {
  return invoiceLikeInput(org, detail, "receipt", isPro);
}
```

Note: the 5 call sites are updated in Task 7 (they will not typecheck until then — that is expected and fixed within this plan).

- [ ] **Step 8: Run the pure tests (call sites are fixed in Task 7)**

Run: `pnpm vitest run src/lib/pdf.test.ts src/lib/docPdf` (docPdf has no test file; this just confirms pdf tests still pass).
Expected: PASS. (Do **not** run `pnpm typecheck` yet — Task 7 fixes the call sites.)

- [ ] **Step 9: Commit**

```bash
cd "C:/Users/pagan/Claude/App"
git add apps/mobile/src/lib/pdf.ts apps/mobile/src/lib/pdf.test.ts apps/mobile/src/lib/docPdf.ts
git commit -m "feat(mobile): print-safe free-tier PDF watermark, isPro threaded through mappers"
```

---

## Task 4: RevenueCat dependency, env, and platform-split wrapper

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/.env.example`
- Create: `apps/mobile/src/subscriptions/purchasesClient.ts`
- Create: `apps/mobile/src/subscriptions/purchasesClient.web.ts`

- [ ] **Step 1: Verify the compatible RevenueCat version**

Per `AGENTS.md`, check https://www.revenuecat.com/docs/getting-started/installation/expo for the version supporting Expo SDK 57 / RN 0.86 / New Architecture. Use the latest `react-native-purchases` major that lists RN 0.8x support (expected `^9.x` or newer). Record the exact version chosen.

- [ ] **Step 2: Add the dependency**

In `apps/mobile/package.json`, add to `dependencies` (alphabetical position, use the version confirmed in Step 1):

```json
    "react-native-purchases": "^9.7.0",
```

- [ ] **Step 3: Install**

Run (from repo root): `pnpm install`
Expected: lockfile updates, `react-native-purchases` resolves. If peer-dependency errors mention RN/React, re-check Step 1's version.

- [ ] **Step 4: Add env keys**

Append to `apps/mobile/.env.example`:

```
# RevenueCat iOS public SDK key (App Store) — from the RevenueCat dashboard.
EXPO_PUBLIC_REVENUECAT_IOS_KEY=<revenuecat ios public sdk key>
# Base URL of the deployed web app — used for paywall Privacy/Support links.
EXPO_PUBLIC_WEB_URL=https://fasttrack.app
```

(The owner sets real values in `.env`; do not edit `.env` — it is git-ignored and holds live values.)

- [ ] **Step 5: Create the native wrapper**

Create `apps/mobile/src/subscriptions/purchasesClient.ts`:

```ts
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
```

- [ ] **Step 6: Create the web stub**

Create `apps/mobile/src/subscriptions/purchasesClient.web.ts`:

```ts
/**
 * Web no-op stub for the RevenueCat wrapper. react-native-purchases has no web
 * runtime; on the web preview the app is always treated as free (packages empty,
 * purchase/restore no-op). Mirrors the openDriver.web.ts platform-split pattern.
 */

export interface ProPackage {
  readonly identifier: string;
  readonly packageType: string;
  readonly product: { readonly priceString: string; readonly title: string };
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
```

- [ ] **Step 7: Typecheck the new module**

Run: `pnpm typecheck`
Expected: The subscriptions wrapper typechecks. (Task 3's call sites are still broken — expected; fixed in Task 7. If the only errors are in `estimate/[id]/index.tsx`, `invoice/[id].tsx`, that is on track.)

- [ ] **Step 8: Commit**

```bash
cd "C:/Users/pagan/Claude/App"
git add apps/mobile/package.json apps/mobile/.env.example pnpm-lock.yaml apps/mobile/src/subscriptions/purchasesClient.ts apps/mobile/src/subscriptions/purchasesClient.web.ts
git commit -m "feat(mobile): add RevenueCat dep, env keys, platform-split purchases wrapper"
```

---

## Task 5: SubscriptionProvider + `useEntitlement()`

**Files:**
- Create: `apps/mobile/src/subscriptions/SubscriptionProvider.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx`

- [ ] **Step 1: Create the provider**

Create `apps/mobile/src/subscriptions/SubscriptionProvider.tsx`:

```tsx
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
```

- [ ] **Step 2: Mount it in the root layout**

In `apps/mobile/src/app/_layout.tsx`, add the import after the DbProvider import (line 19):

```tsx
import { DbProvider, useDb } from "@/db/DbProvider";
import { SubscriptionProvider } from "@/subscriptions/SubscriptionProvider";
import { colors } from "@/theme";
```

Then wrap the tree — change the `return` in `RootLayout` from:

```tsx
  return (
    <DbProvider>
      <OnboardingGate>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.screenBg },
          }}
        />
      </OnboardingGate>
    </DbProvider>
  );
```

to:

```tsx
  return (
    <DbProvider>
      <SubscriptionProvider>
        <OnboardingGate>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.screenBg },
            }}
          />
        </OnboardingGate>
      </SubscriptionProvider>
    </DbProvider>
  );
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: Provider + layout typecheck clean (call sites from Task 3 still pending — fixed next task).

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/pagan/Claude/App"
git add apps/mobile/src/subscriptions/SubscriptionProvider.tsx apps/mobile/src/app/_layout.tsx
git commit -m "feat(mobile): SubscriptionProvider + useEntitlement, mounted at root"
```

---

## Task 6: Paywall screen (`/paywall`)

A themed, Apple-compliant paywall: renders live offerings, a purchase CTA, **Restore Purchases** (required), and **Terms + Privacy** links (required for auto-renewing subscriptions). expo-router auto-registers `src/app/paywall.tsx` as route `/paywall`.

**Files:**
- Create: `apps/mobile/src/app/paywall.tsx`

- [ ] **Step 1: Create the paywall screen**

Create `apps/mobile/src/app/paywall.tsx`:

```tsx
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/ui/Buttons";
import { Icon } from "@/components/ui/Icon";
import { FREE_CLIENT_CAP, FREE_DOCUMENT_CAP } from "@/lib/gating";
import { useEntitlement } from "@/subscriptions/SubscriptionProvider";
import type { ProPackage } from "@/subscriptions/purchasesClient";
import { colors, fonts, spacing } from "@/theme";

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "https://fasttrack.app";
const PRIVACY_URL = `${WEB_URL}/privacy`;
// Apple's standard auto-renewing-subscription EULA (accepted default Terms of Use).
const TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

const PRO_FEATURES: readonly string[] = [
  "Unlimited clients and documents",
  "Clean PDFs — no FastTrack footer",
  "Cloud sync across your devices",
];

export default function PaywallScreen() {
  const router = useRouter();
  const { packages, purchase, restore } = useEntitlement();
  const [selected, setSelected] = useState<string | null>(packages[0]?.identifier ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePkg: ProPackage | undefined =
    packages.find((p) => p.identifier === selected) ?? packages[0];

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const buy = () => {
    if (!activePkg) {
      setError("Plans are still loading — try again in a moment.");
      return;
    }
    void run(() => purchase(activePkg));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable style={styles.close} onPress={() => router.back()} accessibilityLabel="Close">
          <Icon name="back" size={18} color={colors.slate} />
        </Pressable>
        <Text style={styles.kicker}>FASTTRACK PRO</Text>
      </View>

      <Text style={styles.title}>Run your whole business, uncapped.</Text>
      <Text style={styles.blurb}>
        The free plan covers {FREE_CLIENT_CAP} clients and {FREE_DOCUMENT_CAP} documents. Upgrade to
        Pro for unlimited work, clean PDFs, and cloud sync.
      </Text>

      <View style={styles.features}>
        {PRO_FEATURES.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Icon name="check" size={16} color={colors.green} strokeWidth={2.2} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {packages.length === 0 ? (
        <Text style={styles.blurb}>Plans are loading…</Text>
      ) : (
        <View style={styles.plans}>
          {packages.map((pkg) => {
            const active = (activePkg?.identifier ?? null) === pkg.identifier;
            return (
              <Pressable
                key={pkg.identifier}
                style={[styles.plan, active && styles.planActive]}
                onPress={() => setSelected(pkg.identifier)}
              >
                <Text style={[styles.planName, active && styles.planNameActive]}>
                  {pkg.product.title}
                </Text>
                <Text style={[styles.planPrice, active && styles.planNameActive]}>
                  {pkg.product.priceString}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label={busy ? "Working…" : "Start Pro"}
        onPress={buy}
        disabled={busy || packages.length === 0}
        style={styles.cta}
      />

      <Pressable onPress={() => run(restore)} disabled={busy}>
        <Text style={styles.restore}>Restore purchases</Text>
      </Pressable>

      <View style={styles.legal}>
        <Pressable onPress={() => void Linking.openURL(TERMS_URL)}>
          <Text style={styles.legalLink}>Terms of Use</Text>
        </Pressable>
        <Text style={styles.legalDot}>·</Text>
        <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)}>
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </Pressable>
      </View>
      <Text style={styles.finePrint}>
        Subscriptions renew automatically until cancelled. Manage or cancel anytime in your App Store
        account settings.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  content: { padding: spacing.screenX, paddingTop: 52, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 18 },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderCircle,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: { fontSize: 10.5, fontFamily: fonts.sans700, letterSpacing: 1.5, color: colors.green },
  title: {
    fontSize: 24,
    fontFamily: fonts.sans800,
    letterSpacing: -0.5,
    color: colors.ink,
    marginTop: 4,
  },
  blurb: {
    fontSize: 13.5,
    fontFamily: fonts.sans500,
    color: colors.slate,
    lineHeight: 20,
    marginTop: 10,
  },
  features: { marginTop: 20, gap: 12 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontSize: 14, fontFamily: fonts.sans600, color: colors.ink },
  plans: { flexDirection: "row", gap: 10, marginTop: 24 },
  plan: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderButton,
    borderRadius: spacing.cardRadius,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  planActive: { borderColor: colors.green, backgroundColor: colors.greenWash },
  planName: { fontSize: 13, fontFamily: fonts.sans700, color: colors.slate },
  planNameActive: { color: colors.greenDark },
  planPrice: { fontSize: 17, fontFamily: fonts.mono700, color: colors.ink },
  cta: { marginTop: 24 },
  restore: {
    marginTop: 16,
    fontSize: 13,
    fontFamily: fonts.sans700,
    color: colors.green,
    textAlign: "center",
  },
  error: { marginTop: 14, fontSize: 12.5, fontFamily: fonts.sans600, color: colors.red },
  legal: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 22,
  },
  legalLink: { fontSize: 12, fontFamily: fonts.sans600, color: colors.slate },
  legalDot: { color: colors.faint },
  finePrint: {
    marginTop: 10,
    fontSize: 10.5,
    fontFamily: fonts.sans500,
    color: colors.faint,
    textAlign: "center",
    lineHeight: 15,
  },
});
```

- [ ] **Step 2: Verify `Icon` supports the names used**

Confirm `check` and `back` exist in `src/components/ui/Icon.tsx` (both are already used elsewhere: `back` in every screen header, `check` in sync/invoice). If `check` is missing, use an existing checkmark-style name from that file.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: paywall typechecks (Task 3 call sites still pending).

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/pagan/Claude/App"
git add apps/mobile/src/app/paywall.tsx
git commit -m "feat(mobile): Pro paywall screen with offerings, restore, and legal links"
```

---

## Task 7: Wire gates and thread `isPro` into PDFs

Completes the type contract from Task 3 (the 5 PDF call sites) and enforces the three gates. After this task the whole mobile app typechecks and tests pass.

**Files:**
- Modify: `apps/mobile/src/app/estimate/new.tsx`
- Modify: `apps/mobile/src/app/estimate/[id]/index.tsx`
- Modify: `apps/mobile/src/app/invoice/[id].tsx`
- Modify: `apps/mobile/src/app/sync.tsx`

- [ ] **Step 1: Gate client + document creation in `estimate/new.tsx`**

Add imports (after line 16, the existing repo imports):

```tsx
import { listClients } from "@/db/repos/clientRepo";
import { createDraft, listEstimates } from "@/db/repos/estimateRepo";
import { listInvoices } from "@/db/repos/invoiceRepo";
import { canAddClient, canAddDocument } from "@/lib/gating";
import { useEntitlement } from "@/subscriptions/SubscriptionProvider";
```

(Adjust the existing `import { createDraft } from "@/db/repos/estimateRepo";` line to the combined `createDraft, listEstimates` form shown above, and keep the existing `listClients` import.)

Inside `NewEstimate`, after the existing `clients` query (line 26), add:

```tsx
  const { isPro } = useEntitlement();
  const estimates = useQuery((c) => (orgId ? listEstimates(c, orgId) : Promise.resolve([])), [orgId]);
  const invoices = useQuery((c) => (orgId ? listInvoices(c, orgId) : Promise.resolve([])), [orgId]);
```

At the very top of the `create` function body (before `setBusy(true)`), add the gate:

```tsx
  const create = async () => {
    const clientCount = clients.data?.length ?? 0;
    const docCount = (estimates.data?.length ?? 0) + (invoices.data?.length ?? 0);
    if (mode === "new" && !canAddClient(clientCount, isPro)) {
      router.push("/paywall");
      return;
    }
    if (!canAddDocument(docCount, isPro)) {
      router.push("/paywall");
      return;
    }
    setBusy(true);
    setError(null);
    // ...rest unchanged
```

- [ ] **Step 2: Gate convert + thread isPro in `estimate/[id]/index.tsx`**

Add imports (after line 20):

```tsx
import { listEstimates } from "@/db/repos/estimateRepo";
import { convertFromEstimate, invoiceForEstimate, listInvoices } from "@/db/repos/invoiceRepo";
import { canAddDocument } from "@/lib/gating";
import { useEntitlement } from "@/subscriptions/SubscriptionProvider";
```

(Merge `listEstimates` into the existing `estimateRepo` import group, and `listInvoices` into the existing `invoiceRepo` import that already brings `convertFromEstimate, invoiceForEstimate`.)

After the existing queries (line 32), add:

```tsx
  const { isPro } = useEntitlement();
  const orgId = org?.id ?? "";
  const estimates = useQuery((c) => (orgId ? listEstimates(c, orgId) : Promise.resolve([])), [orgId]);
  const invoices = useQuery((c) => (orgId ? listInvoices(c, orgId) : Promise.resolve([])), [orgId]);
```

Thread `isPro` into both estimate PDF calls — change lines 55 and 59 from `estimatePdfInput(org, data)` to:

```tsx
      await sharePdf(buildDocumentHtml(estimatePdfInput(org, data, isPro)));
```

Gate the `convert` handler — change it from:

```tsx
  const convert = () =>
    run(async () => {
      const invoice = await mutate((c) => convertFromEstimate(c, id));
      router.push({ pathname: "/invoice/[id]", params: { id: invoice.id } });
    });
```

to:

```tsx
  const convert = () => {
    const docCount = (estimates.data?.length ?? 0) + (invoices.data?.length ?? 0);
    if (!canAddDocument(docCount, isPro)) {
      router.push("/paywall");
      return;
    }
    void run(async () => {
      const invoice = await mutate((c) => convertFromEstimate(c, id));
      router.push({ pathname: "/invoice/[id]", params: { id: invoice.id } });
    });
  };
```

- [ ] **Step 3: Thread isPro into `invoice/[id].tsx` PDFs**

Add imports (after line 22):

```tsx
import { useEntitlement } from "@/subscriptions/SubscriptionProvider";
```

Inside `InvoiceDetailScreen`, after `const router = useRouter();` (line 82), add:

```tsx
  const { isPro } = useEntitlement();
```

Change the three PDF calls:
- Line 118 `invoicePdfInput(org, data)` → `invoicePdfInput(org, data, isPro)`
- Line 122 `receiptPdfInput(org, data)` → `receiptPdfInput(org, data, isPro)`
- Line 126 `invoicePdfInput(org, data)` → `invoicePdfInput(org, data, isPro)`

- [ ] **Step 4: Gate sync in `sync.tsx`**

Add imports (after line 18, the theme import):

```tsx
import { canSync } from "@/lib/gating";
import { useEntitlement } from "@/subscriptions/SubscriptionProvider";
```

Inside `SyncScreen`, after `const router = useRouter();` (line 25), add:

```tsx
  const { isPro } = useEntitlement();
```

At the top of `linkAndPush` (before the `if (!org)` check), add:

```tsx
  const linkAndPush = async () => {
    if (!canSync(isPro)) {
      router.push("/paywall");
      return;
    }
    if (!org) {
      setMessage("Finish onboarding first.");
      return;
    }
    // ...rest unchanged
```

- [ ] **Step 5: Confirm `listInvoices` signature**

Open `apps/mobile/src/db/repos/invoiceRepo.ts` at `listInvoices` (~line 262). Confirm it is callable as `listInvoices(ctx, orgId)`. If it takes extra required params, pass the same values the invoices tab (`src/app/(tabs)/invoices.tsx`) passes. Adjust the four `listInvoices(c, orgId)` call sites above accordingly.

- [ ] **Step 6: Typecheck + full mobile test**

Run: `pnpm typecheck && pnpm test`
Expected: BOTH PASS. All PDF call sites now supply `isPro`; gating + entitlement + pdf tests green.

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/pagan/Claude/App"
git add apps/mobile/src/app/estimate/new.tsx apps/mobile/src/app/estimate/[id]/index.tsx apps/mobile/src/app/invoice/[id].tsx apps/mobile/src/app/sync.tsx
git commit -m "feat(mobile): enforce freemium gates (clients/documents/sync) and watermark PDFs"
```

---

## Task 8: iOS release config in `app.json`

**Files:**
- Modify: `apps/mobile/app.json`

- [ ] **Step 1: Verify the marketing icon**

The current `ios.icon` points at `./assets/expo.icon` (a partially-scaffolded folder). Confirm `assets/images/icon.png` is **1024×1024** and has **no alpha channel** (Apple rejects transparency in the marketing icon). On Windows PowerShell:

```powershell
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("C:/Users/pagan/Claude/App/apps/mobile/assets/images/icon.png")
"$($img.Width)x$($img.Height)  pixelformat=$($img.PixelFormat)"
$img.Dispose()
```

Expected: `1024x1024`. If the size differs or `pixelformat` contains `Alpha`, regenerate a 1024² opaque PNG (flatten onto the brand green `#0f5233`) before continuing, and note it in the commit.

- [ ] **Step 2: Rewrite the iOS block**

In `apps/mobile/app.json`, replace the `"ios"` object:

```json
    "ios": {
      "icon": "./assets/images/icon.png"
    },
```

with:

```json
    "ios": {
      "bundleIdentifier": "com.fasttrackapp.mobile",
      "buildNumber": "1",
      "icon": "./assets/images/icon.png",
      "supportsTablet": false,
      "infoPlist": {
        "NSCameraUsageDescription": "FastTrack uses the camera to attach photos of jobs and receipts to your estimates and invoices.",
        "NSPhotoLibraryUsageDescription": "FastTrack attaches photos from your library to jobs, estimates, and invoices.",
        "ITSAppUsesNonExemptEncryption": false
      },
      "privacyManifests": {
        "NSPrivacyTracking": false,
        "NSPrivacyAccessedAPITypes": [
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
            "NSPrivacyAccessedAPITypeReasons": ["CA92.1"]
          },
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryFileTimestamp",
            "NSPrivacyAccessedAPITypeReasons": ["C617.1"]
          },
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryDiskSpace",
            "NSPrivacyAccessedAPITypeReasons": ["E174.1"]
          },
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategorySystemBootTime",
            "NSPrivacyAccessedAPITypeReasons": ["35F9.1"]
          }
        ]
      }
    },
```

- [ ] **Step 3: Bump the app version**

In `apps/mobile/app.json`, change `"version": "0.1.0"` to `"version": "1.0.0"`.

- [ ] **Step 4: Verify Expo can read the config**

Run: `pnpm exec expo config --type public`
Expected: prints resolved config JSON with `ios.bundleIdentifier` = `com.fasttrackapp.mobile`, no schema errors. (Per `AGENTS.md`, cross-check any flagged key against the v57 docs.)

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/pagan/Claude/App"
git add apps/mobile/app.json
git commit -m "feat(mobile): iOS release config - bundle id, version, permissions, privacy manifest"
```

---

## Task 9: `eas.json` build + submit profiles

**Files:**
- Create: `apps/mobile/eas.json`

- [ ] **Step 1: Create the file**

Create `apps/mobile/eas.json`:

```json
{
  "cli": {
    "version": ">= 12.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {}
    },
    "production": {
      "ios": {}
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "APPLE_ID_EMAIL_SET_BY_OWNER",
        "ascAppId": "ASC_APP_ID_SET_BY_OWNER",
        "appleTeamId": "APPLE_TEAM_ID_SET_BY_OWNER"
      }
    }
  }
}
```

The three `submit.production.ios` values are filled by the owner during the runbook (Task 12) — they are per-account credentials, not code. `appVersionSource: "local"` makes `app.json`'s `version`/`buildNumber` the source of truth.

- [ ] **Step 2: Validate**

Run: `pnpm exec eas build --profile production --platform ios --dry-run` (if `eas-cli` is available) or at minimum confirm the JSON parses: `node -e "JSON.parse(require('fs').readFileSync('apps/mobile/eas.json','utf8')); console.log('ok')"` (from repo root).
Expected: `ok` (or EAS dry-run validates the profile). Actual EAS builds happen in the runbook after `eas login`.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/pagan/Claude/App"
git add apps/mobile/eas.json
git commit -m "feat(mobile): eas.json with development/preview/production + ios submit profile"
```

---

## Task 10: Public privacy + support pages in the web app

Apple requires a reachable Privacy Policy URL and Support URL. Add them as public top-level routes in the Next.js 15 App Router app (siblings of `login`/`onboarding`, outside the auth-gated `(dash)` group).

**Files:**
- Create: `apps/web/src/app/privacy/page.tsx`
- Create: `apps/web/src/app/support/page.tsx`

- [ ] **Step 1: Confirm top-level routes are public**

Check for `apps/web/src/middleware.ts` (or `middleware.ts` at web root). If present, confirm it does not force auth on `/privacy` or `/support` (the `(dash)` group holds the authed UI; `login`/`onboarding` are already public siblings). If a matcher would catch them, add `/privacy` and `/support` to its public allowlist.

- [ ] **Step 2: Create the privacy page**

Create `apps/web/src/app/privacy/page.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — FastTrack",
  description: "How FastTrack collects, uses, and protects your data.",
};

const UPDATED = "July 20, 2026";

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px", lineHeight: 1.6 }}>
      <h1>Privacy Policy</h1>
      <p>Last updated: {UPDATED}</p>

      <h2>Who we are</h2>
      <p>
        FastTrack is a business tool for tradespeople to create estimates, invoices, and expense
        records. This policy explains what data the FastTrack mobile app and web dashboard handle.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Business records you create:</strong> clients, jobs, estimates, invoices, payments,
          and expenses. These are stored on your device and, only if you enable Cloud Sync, in your
          FastTrack cloud account.
        </li>
        <li>
          <strong>Photos you attach:</strong> images you pick for jobs, estimates, or invoices. Stored
          on your device and synced only if you enable Cloud Sync.
        </li>
        <li>
          <strong>Account email:</strong> used to sign you in and associate your synced data with you.
        </li>
        <li>
          <strong>Subscription status:</strong> managed by our payments provider (RevenueCat) and
          Apple. We receive whether your subscription is active; we never receive your card details.
        </li>
      </ul>

      <h2>What we do not do</h2>
      <p>
        We do not sell your data, we do not use third-party advertising, and we do not track you across
        other apps or websites.
      </p>

      <h2>Data storage and deletion</h2>
      <p>
        Data stays on your device unless you enable Cloud Sync. To delete synced data or your account,
        contact us at the address below and we will remove it.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or deletion requests: <a href="mailto:usbusiness.ai@gmail.com">usbusiness.ai@gmail.com</a>.
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Create the support page**

Create `apps/web/src/app/support/page.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — FastTrack",
  description: "Get help with FastTrack.",
};

export default function SupportPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px", lineHeight: 1.6 }}>
      <h1>FastTrack Support</h1>
      <p>Need a hand? We usually reply within one business day.</p>

      <h2>Contact</h2>
      <p>
        Email: <a href="mailto:usbusiness.ai@gmail.com">usbusiness.ai@gmail.com</a>
      </p>

      <h2>Common questions</h2>
      <ul>
        <li>
          <strong>Restore a purchase:</strong> open the app, go to the paywall, and tap “Restore
          purchases”.
        </li>
        <li>
          <strong>Manage or cancel a subscription:</strong> use your Apple ID account settings under
          Subscriptions.
        </li>
        <li>
          <strong>Cloud sync:</strong> sign in from the Sync screen to copy your books to the web
          dashboard.
        </li>
      </ul>
    </main>
  );
}
```

- [ ] **Step 4: Build the web app to verify the routes compile**

Run (from repo root): `pnpm --filter web build`
Expected: build succeeds; `/privacy` and `/support` appear as static routes in the output.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/pagan/Claude/App"
git add apps/web/src/app/privacy/page.tsx apps/web/src/app/support/page.tsx
git commit -m "feat(web): public privacy policy and support pages for App Store compliance"
```

---

## Task 11: App Store metadata drafts

**Files:**
- Create: `docs/appstore/metadata.md`
- Create: `docs/appstore/app-privacy.md`
- Create: `docs/appstore/screenshots.md`

- [ ] **Step 1: Create `docs/appstore/metadata.md`**

```markdown
# App Store Connect — Listing Metadata (draft)

**App name:** FastTrack — Estimates & Invoices
_(If "FastTrack" alone is taken, this longer name is the store display name; the on-device name stays "FastTrack".)_

**Subtitle (30 char max):** Estimates, invoices, expenses

**Primary category:** Business
**Secondary category:** Finance

**Promotional text (170 char max):**
Win the job and get paid faster. Build estimates on site, turn them into invoices in a tap, track expenses, and know your profit on every job.

**Description:**
FastTrack is the fastest way for tradespeople and contractors to quote work, invoice clients, and see real profit — even with no signal.

BUILD ESTIMATES ON SITE
- Add line items with your own price book, materials, labor, and markups
- See your cost, profit, and margin update live as you build

GET PAID
- Turn an accepted estimate into an invoice in one tap
- Record payments and share clean PDF invoices and receipts

STAY ON TOP OF THE NUMBERS
- Track expenses and see a monthly health snapshot
- Everything works offline; your data lives on your device

FASTTRACK PRO
- Unlimited clients and documents
- Clean, unbranded PDFs
- Cloud sync to the FastTrack web dashboard across devices

Pro is an auto-renewing subscription (monthly or annual). Payment is charged to your Apple ID; subscriptions renew automatically unless cancelled at least 24 hours before the period ends. Manage or cancel anytime in App Store account settings.

Terms: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy: https://fasttrack.app/privacy   ← replace with the deployed web URL

**Keywords (100 char max, comma-separated):**
estimate,invoice,contractor,tradesman,receipt,expenses,quote,job,electrician,plumber,handyman,billing

**Support URL:** https://fasttrack.app/support   ← replace with the deployed web URL
**Marketing URL (optional):** https://fasttrack.app
**Copyright:** 2026 FastTrack

**Age rating:** 4+ (no objectionable content). Answer "None" to all content-descriptor questions.

**Sign-in for review:** Cloud Sync is optional. Provide the reviewer a demo account email/password (create one in Supabase auth) in App Review notes, or note that the app is fully usable offline without an account.

**App Review notes:**
- The app works fully offline without an account. Cloud Sync (optional) needs an account.
- FastTrack Pro is an auto-renewing subscription. To test: open the app, exceed the free cap (3 clients or 5 documents) or open the Sync screen to reach the paywall; purchase with the sandbox account.
```

- [ ] **Step 2: Create `docs/appstore/app-privacy.md`**

```markdown
# App Store Connect — App Privacy answers (nutrition label)

Derived from the code. **Tracking: No** (no ad SDKs, no cross-app tracking).

## Data types collected

| Data type | Collected | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|
| Contact info — Email address | Yes (only if user enables Cloud Sync / creates account) | Yes | No | App Functionality |
| User content — Photos | Yes (only if attached + Cloud Sync on) | Yes | No | App Functionality |
| User content — Other (business records: clients, jobs, estimates, invoices, expenses) | Yes (only if Cloud Sync on) | Yes | No | App Functionality |
| Purchases — Purchase history | Yes (via RevenueCat/Apple) | Yes | No | App Functionality |
| Identifiers — User ID | Yes (account/RevenueCat app user id) | Yes | No | App Functionality |

Notes:
- If the user never enables Cloud Sync and never subscribes, the app collects nothing off-device. Because collection *can* happen, declare the rows above (App Store requires declaring data that may be collected).
- No location, no contacts import, no browsing history, no diagnostics SDK.
- Third parties: Supabase (data storage for sync), RevenueCat (subscription management), Apple (payments).
```

- [ ] **Step 3: Create `docs/appstore/screenshots.md`**

```markdown
# App Store screenshots — capture spec

Apple requires screenshots for the 6.9"/6.7" iPhone display. Capture on an iPhone 15/16 Pro Max
simulator or device (1290×2796 px). iPad shots are NOT required — `supportsTablet` is false.

Required: 3–10 images. Capture these 6, portrait, in this order:

1. **Home / health snapshot** — the dashboard health card + KPI tiles. Caption: "Know your profit on every job."
2. **New estimate** — the estimate builder with line items + live profit hero. Caption: "Build estimates on site."
3. **Estimate detail** — cost / profit / margin hero. Caption: "See margin as you quote."
4. **Invoice detail** — status banner + line items. Caption: "Invoice in a tap. Get paid."
5. **Invoice/receipt PDF** — the shared PDF preview. Caption: "Clean PDFs clients trust."
6. **Paywall** — FastTrack Pro screen. Caption: "Go Pro: unlimited + cloud sync."

How to capture (after an EAS build or `expo run:ios` on a simulator):
- Simulator → File → Save Screen (⌘S) at the 6.9" size, or drag to resize the window then ⌘S.
- Put files in `docs/appstore/screenshots/` named `01-home.png` … `06-paywall.png` (folder is git-ignored if large; keep locally for upload).

Use the seeded demo data (the app seeds demo clients/estimates) so screenshots show realistic content.
```

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/pagan/Claude/App"
git add docs/appstore/metadata.md docs/appstore/app-privacy.md docs/appstore/screenshots.md
git commit -m "docs: App Store listing metadata, privacy label answers, screenshot spec"
```

---

## Task 12: Owner runbook

**Files:**
- Create: `docs/appstore/RUNBOOK.md`

- [ ] **Step 1: Create the runbook**

Create `docs/appstore/RUNBOOK.md`:

```markdown
# FastTrack iOS — Submission Runbook (owner steps)

Everything in the repo is done. These steps require your Apple/Expo/RevenueCat
accounts and credentials — they cannot be automated for you. Do them in order.

Prereqs: bundle id is `com.fasttrackapp.mobile`, version `1.0.0` build `1`.

## 1. Apple Developer Program ($99/yr)
- Enroll at https://developer.apple.com/programs/enroll/ (needs your legal identity + payment).
- Wait for approval (minutes to ~48h).

## 2. App Store Connect app record
- https://appstoreconnect.apple.com → Apps → + → New App.
- Platform iOS, name (from `docs/appstore/metadata.md`), primary language English (U.S.),
  bundle id `com.fasttrackapp.mobile` (register it under Certificates, IDs & Profiles first if not listed),
  SKU `fasttrack-ios`.
- Note the **ASC App ID** (the numeric Apple ID on the app's App Information page).
- Find your **Apple Team ID** at https://developer.apple.com/account (Membership details).

## 3. Subscriptions + RevenueCat
- In App Store Connect → your app → Subscriptions: create a Subscription Group ("FastTrack Pro"),
  then two products: **Pro Monthly** (`pro_monthly`) and **Pro Annual** (`pro_annual`). Set prices.
  Optionally add a 7-day free-trial intro offer on the annual product.
- Add the required localized display name + description for each; add a review screenshot.
- Create a RevenueCat account (https://app.revenuecat.com), add a Project, add an **App** (App Store)
  with your bundle id and the App-Specific Shared Secret (from App Store Connect → App Information).
- In RevenueCat: create an **Entitlement** with identifier exactly `pro`; attach both products to it.
  Create an **Offering** named `default` with a monthly + annual package pointing at the two products.
- Copy the RevenueCat **iOS public SDK key** (Project → API keys, the "public app-specific" key for Apple).

## 4. Local env + EAS
- In `apps/mobile/.env` set:
  - `EXPO_PUBLIC_REVENUECAT_IOS_KEY=<the ios public sdk key>`
  - `EXPO_PUBLIC_WEB_URL=<your deployed web app base url>` (also update the two URLs in
    `docs/appstore/metadata.md`, and the fallback in `src/app/paywall.tsx` if you want).
- In `apps/mobile/eas.json` fill `submit.production.ios` → `appleId`, `ascAppId`, `appleTeamId`.
- Install EAS CLI: `npm i -g eas-cli`  → `eas login`.
- From `apps/mobile/`: `eas build --platform ios --profile production`
  - When prompted, let EAS manage credentials (it creates the distribution cert + provisioning profile
    in your Apple account). This is where you authenticate with Apple.

## 5. TestFlight + sandbox purchase test
- `eas submit --platform ios --profile production` (uploads the build to TestFlight), or upload from the EAS build page.
- In App Store Connect → Users and Access → Sandbox, create a Sandbox Apple ID.
- Install via TestFlight, sign that device's App Store into the sandbox account, then in the app:
  hit the paywall (exceed the free cap or open Sync), buy Pro, confirm it unlocks, then tap
  **Restore purchases** on a fresh install to confirm restore works. (Apple rejects subscription apps
  whose Restore doesn't work.)

## 6. Fill listing + submit
- Upload the 6 screenshots (`docs/appstore/screenshots.md`).
- Paste metadata (`docs/appstore/metadata.md`) and complete **App Privacy** (`docs/appstore/app-privacy.md`).
- Set the subscription's Terms + Privacy URLs; add App Review notes (demo/sandbox instructions).
- Attach build `1.0.0 (1)`, answer export-compliance (encryption: No / exempt), then **Submit for Review**.

## Gotchas
- "Missing Compliance": already handled via `ITSAppUsesNonExemptEncryption: false` in `app.json`.
- Subscriptions must be **submitted with the app version** the first time (select them under the version).
- Restore Purchases + visible Terms/Privacy on the paywall are mandatory — already built in `paywall.tsx`.
- If review flags the entitlement, confirm the RevenueCat entitlement id is exactly `pro`
  (matches `PRO_ENTITLEMENT_ID` in `src/subscriptions/entitlement.ts`).
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Users/pagan/Claude/App"
git add docs/appstore/RUNBOOK.md
git commit -m "docs: owner runbook for enrollment, RevenueCat, EAS build, and submission"
```

---

## Task 13: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full workspace typecheck**

Run (from repo root `C:/Users/pagan/Claude/App`): `pnpm typecheck`
Expected: PASS for all packages (mobile, web, core, rollups, schema).

- [ ] **Step 2: Full workspace tests**

Run (from repo root): `pnpm test`
Expected: PASS, including the new `gating`, `entitlement`, and `pdf` watermark tests.

- [ ] **Step 3: Web build sanity**

Run (from repo root): `pnpm --filter web build`
Expected: succeeds; `/privacy` and `/support` present.

- [ ] **Step 4: Expo config sanity**

Run (from `apps/mobile/`): `pnpm exec expo config --type public`
Expected: valid config, `ios.bundleIdentifier` = `com.fasttrackapp.mobile`, version `1.0.0`.

- [ ] **Step 5: If anything failed, fix and re-run before finishing.** Do not claim completion without green output from Steps 1–4.

---

## Self-Review (author checklist — completed)

**Spec coverage:**
- Entitlement `pro` + offerings + prices-live → Tasks 2, 4, 5, 6. ✅
- Free vs Pro caps (3 clients / 5 docs / watermark / sync) → Tasks 1, 3, 7. ✅
- `react-native-purchases` + Expo plugin/env → Task 4. ✅
- SubscriptionProvider / useEntitlement / offline cache → Task 5. ✅
- Paywall with restore + Terms/Privacy → Task 6. ✅
- gating.ts pure + tests → Task 1. ✅
- PDF watermark, print-safe, no transforms → Task 3. ✅
- app.json bundle id/version/permissions/privacy manifest/icon → Task 8. ✅
- eas.json 3 profiles + submit stub → Task 9. ✅
- /privacy + /support in web → Task 10. ✅
- Store metadata + App Privacy + screenshots spec → Task 11. ✅
- Runbook → Task 12. ✅
- typecheck + test acceptance → Task 13. ✅

**Note on RevenueCat Expo config plugin:** recent `react-native-purchases` autolinks under EAS/prebuild without a separate `plugins` entry; the spec's "RevenueCat plugin block" is satisfied by the dependency + env in Task 4. If Step-1 doc verification shows a config plugin is now required for SDK 57, add it to `app.json` `plugins` in Task 8 and note it.

**Type consistency:** `isPro: boolean` param order fixed across `estimatePdfInput`/`invoicePdfInput`/`receiptPdfInput` (Task 3) and all 5 call sites (Task 7); `ProPackage` exported from both wrapper variants and consumed by provider + paywall; `PRO_ENTITLEMENT_ID`/`isProEntitlement` consistent (Task 2 → Task 4).

**Placeholder scan:** the only non-code fill-ins are per-account credentials in `eas.json` `submit` and the web URL — both explicitly owner-set and documented in the runbook, not implementation gaps.
```
