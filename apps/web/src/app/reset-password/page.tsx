"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD = 8;

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

/**
 * Sets a new password. Reached from a recovery email via /auth/callback, which
 * has already exchanged the link's code for a session — so this page only ever
 * runs for a verified holder of the address.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }

    setIsBusy(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(authErrorMessage(updateError));
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
        <h1 style={{ font: "700 21px/1.2 var(--font-jakarta)", letterSpacing: "-.02em" }}>
          Choose a new password
        </h1>
        <p style={{ marginTop: 7, color: "var(--muted)", fontSize: 13.5 }}>
          At least {MIN_PASSWORD} characters. You will be signed in once it is saved.
        </p>

        <form onSubmit={submit} style={{ marginTop: 20, display: "grid", gap: 14 }}>
          <div>
            <label style={labelStyle} htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              required
              minLength={MIN_PASSWORD}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="confirm-password">Confirm password</label>
            <input
              id="confirm-password"
              type="password"
              required
              minLength={MIN_PASSWORD}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={inputStyle}
            />
          </div>
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
            {isBusy ? "Saving…" : "Save password"}
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
