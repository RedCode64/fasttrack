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
