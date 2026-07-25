"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: 11,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  fontSize: 14,
  fontFamily: "inherit",
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setMessage(null);
    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      setMessage(
        error ? error.message : "Check your email to confirm your account, then sign in.",
      );
      setIsBusy(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      setIsBusy(false);
      return;
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
      <div className="card" style={{ width: 380, padding: "30px 28px", animation: "fadeUp .4s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M13 2 4 13.5h6l-1 8.5 9-12h-6z" />
            </svg>
          </div>
          <span style={{ font: "800 19px/1 var(--font-jakarta)", letterSpacing: "-.03em" }}>
            FastTrack
          </span>
        </div>

        <h1 style={{ font: "700 21px/1.2 var(--font-jakarta)", letterSpacing: "-.02em" }}>
          {mode === "signin" ? "Sign in to your dashboard" : "Create your account"}
        </h1>
        <p style={{ marginTop: 7, color: "var(--muted)", fontSize: 13.5 }}>
          Review your numbers. Estimates and invoices are created in the FastTrack app.
        </p>

        <form onSubmit={submit} style={{ marginTop: 20, display: "grid", gap: 11 }}>
          <input
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            aria-label="Email"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            aria-label="Password"
          />
          <button
            type="submit"
            disabled={isBusy}
            style={{
              padding: "11px 13px",
              borderRadius: 11,
              background: "var(--accent-deep)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              opacity: isBusy ? 0.7 : 1,
            }}
          >
            {isBusy ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        {message && (
          <p role="status" style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>
            {message}
          </p>
        )}

        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMessage(null);
          }}
          style={{ marginTop: 16, fontSize: 13, fontWeight: 700, color: "var(--accent-soft)" }}
        >
          {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
