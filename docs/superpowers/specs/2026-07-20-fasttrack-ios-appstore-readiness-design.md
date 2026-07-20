# FastTrack — iOS App Store Readiness (Design Spec)

- **Date:** 2026-07-20
- **Status:** Approved (brainstorming) → ready for implementation plan
- **Branch:** `feat/ios-appstore-readiness`
- **Author context:** Windows 11 dev machine, Expo SDK 57 / RN 0.86 / React 19 monorepo (`apps/mobile`, `apps/web`, `packages/*`).

## 1. Goal

Get the FastTrack iOS app to the point where a build would **pass Apple App Store review**, and hand the owner an exact runbook for the account/enrollment/signing/submit steps that only they can perform.

Per the owner's decisions, v1 **must ship with in-app subscriptions** (freemium), so this is two workstreams:

- **A — Release engineering:** submission config, assets, privacy, store metadata, runbook.
- **B — In-app subscriptions:** RevenueCat integration, paywall, entitlement gating.

Both are required before the first submission.

## 2. Scope boundary (who does what)

**Claude does (in-repo):** all app config, code, assets normalization, privacy-policy + support pages in the web app, store-metadata drafts, the App Privacy nutrition-label answers, and the written runbook.

**Owner does (external, by necessity — cannot be delegated):**
- Enroll in the Apple Developer Program ($99/yr).
- Create/sign in to the Expo (EAS) account and Apple account; provide credentials interactively.
- Create the App Store Connect app record, subscription products, and RevenueCat project/API key.
- Generate signing certificates and press **Submit for Review**.

Claude will **not** create/enroll accounts, enter the owner's credentials, generate signing certs interactively, or submit.

## 3. Decisions locked in brainstorming

| Decision | Choice |
|---|---|
| Session target | Repo submission-ready + runbook |
| Monetization for v1 | Subscriptions **required** |
| IAP approach | **RevenueCat** (`react-native-purchases` + Expo config plugin) |
| Gating model | **Freemium** (free capped tier + Pro) |
| Apple account status | **Not yet enrolled** → enrollment is runbook step 1 |
| Bundle identifier | `com.fasttrackapp.mobile` |
| App version / build | `1.0.0` / build `1` |

## 4. Workstream B — Subscriptions

### 4.1 Entitlement & products

- One RevenueCat **entitlement**: `pro`.
- One **offering** (`default`) exposing two products: **Pro Monthly** and **Pro Annual**.
- Prices and any free-trial (StoreKit intro offer, e.g. 7 days on annual) are configured later in App Store Connect and read **live** from RevenueCat offerings at runtime. No prices hardcoded.

### 4.2 Free vs Pro

| Capability | Free | Pro |
|---|---|---|
| Clients | up to **3** | Unlimited |
| Estimates + invoices | up to **5 total** (combined) | Unlimited |
| Expenses | ✅ | ✅ |
| PDF export | ✅ with **"Made with FastTrack"** footer watermark | Clean (no watermark) + business header |
| Cloud sync / multi-device | ❌ (routes to paywall) | ✅ |

The document cap counts estimates + invoices combined. Existing records above a cap are never deleted or hidden; only **creating new** ones past the cap is gated (graceful downgrade behavior).

### 4.3 Components & files

- **Config:** add `react-native-purchases` dependency + its Expo config plugin to `app.json`. iOS API key read from `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (added to `.env.example`). Requires an EAS build (not Expo Go) — already the project's path.
- **`src/subscriptions/SubscriptionProvider.tsx`** (new): configures RevenueCat on mount, subscribes to `CustomerInfo`, exposes context via `useEntitlement() → { isPro, offerings, purchasePackage(), restore(), isReady }`. Entitlement state is offline-cached by RevenueCat. Mounted inside `src/app/_layout.tsx`.
- **`src/lib/gating.ts`** (new): pure functions
  - `canAddClient(currentCount: number, isPro: boolean): boolean`
  - `canAddDocument(currentCount: number, isPro: boolean): boolean`
  - `canSync(isPro: boolean): boolean`
  - plus cap constants `FREE_CLIENT_CAP = 3`, `FREE_DOCUMENT_CAP = 5`.
  Fully unit-tested (TDD, RED→GREEN); no native dependency so it runs under vitest.
- **`src/app/paywall.tsx`** (new): themed paywall screen. Monthly/annual toggle, feature list, purchase CTA, **Restore Purchases** control, and **Terms of Use + Privacy Policy** links (all Apple-required for auto-renewing subscriptions). Presented modally; dismissible.
- **Gate wiring:** at client-create (`clientRepo` create path / new-client UI), estimate/invoice create (`estimate/new.tsx`, invoice create path), and the **sync screen** (`src/app/sync.tsx`). A blocked action navigates to `/paywall` with a short reason string.
- **PDF watermark:** conditional footer block in `src/lib/docPdf.ts` HTML — a plain positioned block, **no CSS transforms** (honors the print-safe-CSS constraint: transforms cause print drivers to rasterize the page into blurry tiles). Watermark present when `!isPro`.

### 4.4 Testing

- Unit tests for `gating.ts` covering both sides of each cap and the Pro bypass.
- The purchases layer is behind the `useEntitlement()` interface so screens can be reasoned about with a mock entitlement; the native module itself is validated on-device via a **Sandbox Apple ID** during the EAS build (runbook step).

## 5. Workstream A — Release config

### 5.1 `app.json` (ios)

- `ios.bundleIdentifier = "com.fasttrackapp.mobile"`.
- `version = "1.0.0"`, `ios.buildNumber = "1"`.
- **Icon normalization:** the current `ios.icon` points at a partially-scaffolded `assets/expo.icon` folder. Replace with a validated **1024×1024, opaque (no alpha)** PNG source (Apple rejects transparency in the marketing icon). Verify/flatten the existing `assets/images/icon.png`.
- `ios.infoPlist`: `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` (the app attaches job/receipt photos via `expo-image-picker`).
- `ios.privacyManifests` → `NSPrivacyAccessedAPITypes` with required-reason codes for the file-timestamp / `UserDefaults` APIs Expo uses (Apple 2024 requirement).
- RevenueCat config-plugin entry.

### 5.2 `eas.json` (new)

Profiles: `development` (dev client, internal distribution), `preview` (internal), `production` (store). Include a `submit.production.ios` stub for `eas submit` (Apple ID / ASC app ID / team ID filled by owner).

### 5.3 Privacy + support presence (in `apps/web`)

Apple requires a reachable **Privacy Policy URL** and **Support URL**. Add `/privacy` and `/support` routes to the existing web dashboard. The privacy policy is drafted from what the code actually collects:
- Business data (clients, jobs, estimates, invoices, expenses) stored locally in SQLite and, if the user enables sync, in Supabase.
- Photos selected by the user, stored locally and synced if enabled.
- RevenueCat purchase/subscription data.
- **No** advertising identifiers, **no** third-party ad tracking.

### 5.4 Store metadata (`docs/appstore/`)

Drafted, ready to paste into App Store Connect:
- `metadata.md`: app name, subtitle, promotional text, description, keywords, primary category (**Business**), age-rating questionnaire answers.
- `app-privacy.md`: the **App Privacy nutrition-label** answers (data types, linkage, tracking) derived from the code.
- `screenshots.md`: exact required device sizes (6.9"/6.7" and 13" iPad if iPad-supported), the 6–8 screens to capture, and a caption per screen. (Claude cannot capture device screenshots; this pins down exactly what the owner shoots.)

### 5.5 Runbook (`docs/appstore/RUNBOOK.md`)

Ordered, copy-pasteable, with gotchas:
1. Enroll in Apple Developer Program ($99/yr).
2. Create App Store Connect app record + register the bundle ID.
3. Create the two subscription products; create the RevenueCat project, wire the entitlement/offering, paste the iOS API key into `.env`.
4. `eas login`; `eas build -p ios --profile production`.
5. TestFlight + Sandbox Apple ID purchase test (verify buy + restore).
6. Fill metadata, upload screenshots, complete App Privacy, submit for review.

## 6. Risks / to verify during implementation

- `react-native-purchases` version compatibility with Expo SDK 57 / RN 0.86 / React 19 (New Architecture). Pin a compatible version; fall back to `expo-iap` only if blocked.
- Confirm `assets/images/icon.png` is genuinely 1024² and alpha-free; regenerate if not.
- Confirm the web app's routing convention (framework) before adding `/privacy` + `/support`.

## 7. Out of scope for v1

- RevenueCat → Supabase webhook server-side entitlement mirroring.
- Android release (config will not regress Android, but Play Store submission is a separate effort).
- Localization of store metadata beyond English.

## 8. Acceptance criteria

- `app.json` has a valid bundle ID, version/build, permission strings, privacy manifest, and RevenueCat plugin; `eas.json` present with three profiles.
- `gating.ts` unit tests pass; free caps and Pro bypass verified.
- Paywall screen renders offerings, supports purchase + restore, links Terms/Privacy.
- Free-tier PDFs carry the watermark; Pro PDFs do not.
- `/privacy` and `/support` exist in the web app.
- `docs/appstore/` contains metadata, app-privacy, screenshots spec, and RUNBOOK.
- `pnpm typecheck` and `pnpm test` pass across the workspace.
