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
