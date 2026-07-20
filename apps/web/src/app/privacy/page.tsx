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
        Questions or deletion requests:{" "}
        <a href="mailto:usbusiness.ai@gmail.com">usbusiness.ai@gmail.com</a>.
      </p>
    </main>
  );
}
