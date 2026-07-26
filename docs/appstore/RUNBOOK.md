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
  then three products at the prices in `docs/appstore/pricing.md`:
  **Pro Weekly** (`pro_weekly`, $4.99/wk), **Pro Monthly** (`pro_monthly`, $14.99/mo),
  **Pro Annual** (`pro_annual`, $99.99/yr).
  All three go in the **same** subscription group so users can move between them without
  double-billing. Optionally add a 7-day free-trial intro offer on the annual product only.
- Add the required localized display name + description for each; add a review screenshot.
- Create a RevenueCat account (https://app.revenuecat.com), add a Project, add an **App** (App Store)
  with your bundle id and the App-Specific Shared Secret (from App Store Connect → App Information).
- In RevenueCat: create an **Entitlement** with identifier exactly `pro`; attach all three products to it.
  Create an **Offering** named `default` with a **weekly + monthly + annual** package
  (use RevenueCat's predefined `$rc_weekly` / `$rc_monthly` / `$rc_annual` identifiers — the
  paywall orders and badges plans off the package type, so custom identifiers fall back to
  the raw store product title).
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
- **Account deletion is mandatory** (guideline 5.1.1(v)) and is built — Sync screen →
  **Delete cloud account**. Point the reviewer at it in the review notes; see
  `app-privacy.md`. Apps that create accounts get rejected without it.
- Two Supabase Auth settings are owner-only and worth turning on before launch
  (Dashboard → Authentication): **leaked password protection** (blocks passwords
  found in HaveIBeenPwned) and **CAPTCHA** (Turnstile/hCaptcha) on sign-up.
- "Missing Compliance": already handled via `ITSAppUsesNonExemptEncryption: false` in `app.json`.
- Subscriptions must be **submitted with the app version** the first time (select them under the version).
- Restore Purchases + visible Terms/Privacy on the paywall are mandatory — already built in `paywall.tsx`.
- If review flags the entitlement, confirm the RevenueCat entitlement id is exactly `pro`
  (matches `PRO_ENTITLEMENT_ID` in `src/subscriptions/entitlement.ts`).
- `react-native-purchases` needs a real EAS build (not Expo Go) — the dev/preview/production profiles in `eas.json` cover this.
