"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TRADES = [
  ["electrical", "Electrical"],
  ["plumbing", "Plumbing"],
  ["hvac", "HVAC"],
  ["general_contracting", "General contracting"],
  ["handyman", "Handyman"],
  ["other", "Other"],
] as const;

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

export default function OnboardingPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [yourName, setYourName] = useState("");
  const [trade, setTrade] = useState<(typeof TRADES)[number][0]>("electrical");
  const [taxRatePct, setTaxRatePct] = useState("8.25");
  const [targetMarginPct, setTargetMarginPct] = useState("30");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !user.email) {
      setError("Your session expired — sign in again.");
      setIsBusy(false);
      return;
    }

    const orgId = crypto.randomUUID();
    const taxRateBps = Math.round(Number.parseFloat(taxRatePct) * 100);
    const targetMarginBps = Math.round(Number.parseFloat(targetMarginPct) * 100);

    // Bootstrap order matters: users row (RLS: own id), org, owner membership,
    // then the two seeders copy this trade's price book + default categories.
    const steps = [
      async () =>
        supabase.from("users").upsert({ id: user.id, email: user.email, name: yourName }),
      async () =>
        supabase.from("organizations").insert({
          id: orgId,
          name: businessName,
          logo_url: null,
          address: null,
          license_no: null,
          trade,
          tax_config: { name: "Sales Tax", rate_bps: taxRateBps },
          target_margin_bps: targetMarginBps,
        }),
      async () =>
        supabase.from("memberships").insert({
          id: crypto.randomUUID(),
          org_id: orgId,
          user_id: user.id,
          role: "owner",
        }),
      async () => supabase.rpc("seed_price_book", { target_org: orgId }),
      async () => supabase.rpc("seed_expense_categories", { target_org: orgId }),
    ];

    for (const step of steps) {
      const { error: stepError } = await step();
      if (stepError) {
        setError(stepError.message);
        setIsBusy(false);
        return;
      }
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div className="card" style={{ width: 440, padding: "30px 28px", animation: "fadeUp .4s ease" }}>
        <h1 style={{ font: "700 22px/1.2 var(--font-jakarta)", letterSpacing: "-.02em" }}>
          Set up your business
        </h1>
        <p style={{ marginTop: 7, color: "var(--muted)", fontSize: 13.5 }}>
          This pre-seeds your price book for your trade and creates your default expense
          categories.
        </p>

        <form onSubmit={submit} style={{ marginTop: 20, display: "grid", gap: 14 }}>
          <div>
            <label style={labelStyle} htmlFor="business">Business name</label>
            <input id="business" required value={businessName} placeholder="Reyes Electric"
              onChange={(e) => setBusinessName(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="yourname">Your name</label>
            <input id="yourname" required value={yourName} placeholder="Marcus Reyes"
              onChange={(e) => setYourName(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="trade">Trade</label>
            <select id="trade" value={trade} style={inputStyle}
              onChange={(e) => setTrade(e.target.value as (typeof TRADES)[number][0])}>
              {TRADES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
            <div>
              <label style={labelStyle} htmlFor="tax">Sales tax %</label>
              <input id="tax" required type="number" step="0.01" min="0" max="30"
                value={taxRatePct} onChange={(e) => setTaxRatePct(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="margin">Target margin %</label>
              <input id="margin" required type="number" step="1" min="1" max="99"
                value={targetMarginPct} onChange={(e) => setTargetMarginPct(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <button type="submit" disabled={isBusy}
            style={{
              padding: "11px 13px", borderRadius: 11, background: "var(--green)",
              color: "#fff", fontWeight: 700, fontSize: 14, opacity: isBusy ? 0.7 : 1,
            }}>
            {isBusy ? "Setting up…" : "Create my dashboard"}
          </button>
        </form>

        {error && (
          <p role="alert" style={{ marginTop: 12, fontSize: 13, color: "var(--red)" }}>
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
