"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "reset";

const MIN_PASSWORD = 8;

/**
 * Sent for every reset request, whether or not the address has an account —
 * a form that answers differently is a list of your users.
 */
const RESET_SENT =
  "If that email has a FastTrack account, a reset link is on its way. The link expires in an hour.";

const LINK_ERRORS: Readonly<Record<string, string>> = {
  link_expired: "That link has expired or was already used. Request a new one below.",
  link_invalid: "That link was not valid. Request a new one below.",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: 11,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  fontSize: 14,
  fontFamily: "inherit",
};

const linkStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "var(--accent-soft)",
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // Read after mount rather than via useSearchParams: this page prerenders, and
  // useSearchParams would force it behind a Suspense boundary for one banner.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code && LINK_ERRORS[code]) {
      setMode("reset");
      setIsError(true);
      setMessage(LINK_ERRORS[code]);
    }
  }, []);

  function switchTo(next: Mode) {
    setMode(next);
    setMessage(null);
    setIsError(false);
  }

  function fail(error: unknown) {
    setIsError(true);
    setMessage(authErrorMessage(error));
    setIsBusy(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setMessage(null);
    setIsError(false);
    const supabase = createClient();

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      // Rate limiting is the one failure worth surfacing; every other outcome
      // reports success so the response cannot confirm an address.
      if (error && /rate limit/i.test(String(error.message))) {
        fail(error);
        return;
      }
      setIsError(false);
      setMessage(RESET_SENT);
      setIsBusy(false);
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) {
        fail(error);
        return;
      }
      setMessage("Check your email to confirm your account, then sign in.");
      setIsBusy(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      fail(error);
      return;
    }
    router.push("/");
    router.refresh();
  }

  const heading =
    mode === "signin"
      ? "Sign in to your dashboard"
      : mode === "signup"
        ? "Create your account"
        : "Reset your password";

  const blurb =
    mode === "reset"
      ? "Enter the email you signed up with and we will send you a reset link."
      : "Review your numbers. Estimates and invoices are created in the FastTrack app.";

  const cta = mode === "signin" ? "Sign in" : mode === "signup" ? "Sign up" : "Send reset link";

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
          {heading}
        </h1>
        <p style={{ marginTop: 7, color: "var(--muted)", fontSize: 13.5 }}>{blurb}</p>

        <form onSubmit={submit} style={{ marginTop: 20, display: "grid", gap: 11 }}>
          <input
            type="email"
            required
            placeholder="you@company.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            aria-label="Email"
          />
          {mode !== "reset" && (
            <input
              type="password"
              required
              minLength={MIN_PASSWORD}
              placeholder="Password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              aria-label="Password"
            />
          )}
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
            {isBusy ? "Working…" : cta}
          </button>
        </form>

        {message && (
          <p
            role={isError ? "alert" : "status"}
            style={{
              marginTop: 12,
              fontSize: 13,
              color: isError ? "var(--red)" : "var(--muted)",
            }}
          >
            {message}
          </p>
        )}

        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 14 }}>
          {mode === "signin" && (
            <>
              <button onClick={() => switchTo("signup")} style={linkStyle}>
                New here? Create an account
              </button>
              <button onClick={() => switchTo("reset")} style={linkStyle}>
                Forgot password?
              </button>
            </>
          )}
          {mode === "signup" && (
            <button onClick={() => switchTo("signin")} style={linkStyle}>
              Have an account? Sign in
            </button>
          )}
          {mode === "reset" && (
            <button onClick={() => switchTo("signin")} style={linkStyle}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
