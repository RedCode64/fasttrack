import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — FastTrack",
  description: "How FastTrack collects, uses, and protects your data.",
};

const UPDATED = "July 26, 2026";
const CONTACT = "usbusiness.ai@gmail.com";

const sectionStyle: React.CSSProperties = { marginTop: 28 };

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px", lineHeight: 1.6 }}>
      <h1>Privacy Policy</h1>
      <p>Last updated: {UPDATED}</p>

      <section style={sectionStyle}>
        <h2>Who we are</h2>
        <p>
          FastTrack is a business tool for tradespeople to create estimates, invoices, and expense
          records. This policy explains what data the FastTrack mobile app and web dashboard handle.
          For the purposes of the GDPR we are the data controller for that information, and you can
          reach us at <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Business records you create:</strong> clients, jobs, estimates, invoices,
            payments, and expenses. These are stored on your device and, only if you enable Cloud
            Sync, in your FastTrack cloud account.
          </li>
          <li>
            <strong>Photos you attach:</strong> images you pick for jobs, estimates, or invoices.
            Stored on your device and synced only if you enable Cloud Sync.
          </li>
          <li>
            <strong>Account email:</strong> used to sign you in and associate your synced data with
            you.
          </li>
          <li>
            <strong>Subscription status:</strong> managed by our payments provider (RevenueCat) and
            Apple. We receive whether your subscription is active; we never receive your card
            details.
          </li>
        </ul>
        <p>
          Note that the client details you enter are information about other people. You are
          responsible for having a proper basis to record them, and we process them on your behalf.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Why we process it, and on what basis</h2>
        <ul>
          <li>
            <strong>To provide the service</strong> — storing and syncing your records, and signing
            you in. Under the GDPR this is performance of our contract with you (Article 6(1)(b)).
          </li>
          <li>
            <strong>To keep the service secure</strong> — rate limiting, abuse prevention, and error
            logs. This is our legitimate interest in a working, non-abused service (Article 6(1)(f)).
          </li>
          <li>
            <strong>To manage subscriptions</strong> — confirming entitlement with Apple and
            RevenueCat, again performance of our contract with you.
          </li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2>What we do not do</h2>
        <p>
          We do not sell or share your personal information as those terms are defined by the CCPA
          and CPRA, we do not use third-party advertising, we do not track you across other apps or
          websites, and we do not use your business records to train machine-learning models.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Where your data lives</h2>
        <p>
          Records stay on your device unless you enable Cloud Sync. When you do, they are stored by
          Supabase on Amazon Web Services infrastructure in the United States (the{" "}
          <code>us-east-1</code> region). If you use FastTrack from outside the United States, this
          means your information is transferred there; where the GDPR applies we rely on the European
          Commission&apos;s Standard Contractual Clauses, entered into with our processors, to cover
          that transfer.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Who else processes it</h2>
        <p>We use a small number of service providers, each bound to process data only on our instructions:</p>
        <ul>
          <li>
            <strong>Supabase</strong> — database, authentication, and file storage for synced data.
          </li>
          <li>
            <strong>Vercel</strong> — hosting for this web dashboard.
          </li>
          <li>
            <strong>RevenueCat</strong> — subscription entitlement status.
          </li>
          <li>
            <strong>Apple</strong> — App Store distribution and payment processing.
          </li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2>How long we keep it</h2>
        <p>
          Synced records are kept for as long as your account exists. When you delete your account we
          remove your business records and your sign-in credentials immediately; backups holding
          copies are cycled out within 30 days. Records that never left your device are gone as soon
          as you delete the app.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Deleting your account</h2>
        <p>
          You can delete your account and all synced data yourself, at any time, with no need to
          contact us:
        </p>
        <ul>
          <li>
            <strong>In the app:</strong> Home → Cloud Sync → Delete account.
          </li>
          <li>
            <strong>On the web:</strong> Settings → Delete account.
          </li>
        </ul>
        <p>
          Deletion is immediate and cannot be undone. It removes your synced clients, jobs,
          estimates, invoices, payments, expenses, and your sign-in credentials. Records held only on
          your phone are removed when you delete the app.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Your rights</h2>
        <p>
          Depending on where you live, you have the right to access the personal information we hold
          about you, to correct it, to delete it, to receive a copy in a portable format, to object
          to or restrict certain processing, and to withdraw consent where we rely on it. California
          residents additionally have the right to know what is collected, to delete it, to opt out
          of sale or sharing (we do neither), and not to be discriminated against for exercising
          these rights.
        </p>
        <p>
          Account deletion and the CSV export in Reports cover erasure and portability directly. For
          anything else, write to <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and we will respond
          within 30 days. If you are in the EEA or UK and are unhappy with our response, you may
          complain to your local data protection authority.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Children</h2>
        <p>
          FastTrack is a tool for running a business and is not directed at children. We do not
          knowingly collect personal information from anyone under 16.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Changes to this policy</h2>
        <p>
          If we change how we handle your data we will update this page and move the date at the top.
          Material changes will also be announced in the app.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Contact</h2>
        <p>
          Questions, requests, or complaints:{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </section>
    </main>
  );
}
