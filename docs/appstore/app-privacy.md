# App Store Connect — App Privacy answers (nutrition label)

Derived from the code. **Tracking: No** (no ad SDKs, no cross-app tracking).

## Data types collected

| Data type | Collected | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|
| Contact info — Email address | Yes (only if user enables Cloud Sync / creates account) | Yes | No | App Functionality |
| User content — Photos | Yes (only if attached + Cloud Sync on) | Yes | No | App Functionality |
| User content — Other (business records: clients, jobs, estimates, invoices, expenses) | Yes (only if Cloud Sync on) | Yes | No | App Functionality |
| Purchases — Purchase history | Yes (via RevenueCat/Apple) | Yes | No | App Functionality |
| Identifiers — User ID | Yes (account / RevenueCat app user id) | Yes | No | App Functionality |

Notes:
- If the user never enables Cloud Sync and never subscribes, the app collects nothing off-device. Because collection *can* happen, declare the rows above (App Store requires declaring data that may be collected).
- No location, no contacts import, no browsing history, no diagnostics SDK.
- Third parties: Supabase (data storage for sync), RevenueCat (subscription management), Apple (payments).

## Account deletion (guideline 5.1.1(v))

The app creates accounts, so Apple requires an in-app path to delete them. It is
built, and review will look for it:

- **In app:** Home → cloud icon (Cloud Sync) → enter email + password → **Delete cloud account**.
  Native confirmation alert, then erasure.
- **On the web:** Settings → Delete account → type `DELETE`.

Both call the `delete_own_account()` database function, which takes no arguments
and resolves its target from the caller's own auth token — it can only ever
delete the caller. It removes the org and every record that cascades from it
(clients, jobs, estimates, invoices, payments, expenses), the membership, the
profile row, and the sign-in credentials.

Books held only on the phone are untouched by this; they go when the app is
deleted. Say so in the review notes so the reviewer does not read local data
surviving as a failure to delete.
