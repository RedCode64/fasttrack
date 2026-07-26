"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Organization } from "@fasttrack/schema";
import { updateOrgSettings } from "@/lib/actions";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: 11,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  fontSize: 14,
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: "var(--muted)",
  marginBottom: 6,
  display: "block",
};

export function SettingsForm({ org }: { org: Organization }) {
  const router = useRouter();
  const [name, setName] = useState(org.name);
  const [address, setAddress] = useState(org.address ?? "");
  const [licenseNo, setLicenseNo] = useState(org.license_no ?? "");
  const [taxName, setTaxName] = useState(org.tax_config.name);
  const [taxRatePct, setTaxRatePct] = useState((org.tax_config.rate_bps / 100).toString());
  const [targetMarginPct, setTargetMarginPct] = useState(
    (org.target_margin_bps / 100).toString(),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setMessage(null);

    const result = await updateOrgSettings({
      name,
      address,
      license_no: licenseNo,
      tax_name: taxName,
      tax_rate_pct: taxRatePct,
      target_margin_pct: targetMarginPct,
    });

    setMessage(result.ok ? "Saved." : result.error);
    setIsBusy(false);
    if (result.ok) {
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ padding: "24px 24px", maxWidth: 560, display: "grid", gap: 15 }}>
      <div>
        <label style={labelStyle} htmlFor="s-name">Business name</label>
        <input id="s-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle} htmlFor="s-address">Address</label>
        <input id="s-address" maxLength={240} value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle} htmlFor="s-license">License #</label>
        <input id="s-license" maxLength={60} value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="s-taxname">Tax name</label>
          <input id="s-taxname" required maxLength={120} value={taxName} onChange={(e) => setTaxName(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="s-taxrate">Tax %</label>
          <input id="s-taxrate" required type="number" step="0.01" min="0" max="30"
            value={taxRatePct} onChange={(e) => setTaxRatePct(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="s-margin">Target margin %</label>
          <input id="s-margin" required type="number" step="1" min="1" max="99"
            value={targetMarginPct} onChange={(e) => setTargetMarginPct(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          type="submit"
          disabled={isBusy}
          style={{
            padding: "11px 18px",
            borderRadius: 11,
            background: "var(--accent-deep)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            opacity: isBusy ? 0.7 : 1,
          }}
        >
          {isBusy ? "Saving…" : "Save changes"}
        </button>
        {message && (
          <span
            role="status"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: message === "Saved." ? "var(--green)" : "var(--red)",
            }}
          >
            {message}
          </span>
        )}
      </div>
    </form>
  );
}
