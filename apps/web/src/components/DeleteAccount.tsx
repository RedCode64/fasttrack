"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteOwnAccount } from "@/lib/actions";
import { DELETE_CONFIRMATION } from "@/lib/constants";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: 11,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  fontSize: 14,
  fontFamily: "inherit",
};

/**
 * Self-service account erasure. Two steps on purpose: the panel stays closed
 * until asked for, and the confirm word has to be typed — this is the one
 * control on the dashboard with no undo.
 */
export function DeleteAccount() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setError(null);

    const result = await deleteOwnAccount(confirmation);
    if (!result.ok) {
      setError(result.error);
      setIsBusy(false);
      return;
    }

    router.push("/login");
    router.refresh();
  }

  return (
    <section
      className="card"
      style={{
        padding: "24px 24px",
        maxWidth: 560,
        marginTop: 22,
        borderColor: "color-mix(in oklab, var(--red) 40%, var(--border))",
      }}
    >
      <h2 style={{ font: "700 15px/1.2 var(--font-jakarta)", letterSpacing: "-.01em" }}>
        Delete account
      </h2>
      <p style={{ marginTop: 7, color: "var(--muted)", fontSize: 13.5, lineHeight: 1.55 }}>
        Permanently erases your cloud account and every synced record — clients, jobs, estimates,
        invoices, payments, and expenses. Books held only on your phone stay there until you delete
        the app. This cannot be undone.
      </p>

      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            marginTop: 16,
            padding: "10px 16px",
            borderRadius: 11,
            border: "1px solid var(--red)",
            color: "var(--red)",
            fontWeight: 700,
            fontSize: 13.5,
            background: "transparent",
          }}
        >
          Delete my account
        </button>
      ) : (
        <form onSubmit={submit} style={{ marginTop: 16, display: "grid", gap: 11 }}>
          <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }} htmlFor="confirm-delete">
            Type {DELETE_CONFIRMATION} to confirm
          </label>
          <input
            id="confirm-delete"
            required
            autoComplete="off"
            maxLength={20}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: 11 }}>
            <button
              type="submit"
              disabled={isBusy || confirmation.trim().toUpperCase() !== DELETE_CONFIRMATION}
              style={{
                padding: "10px 16px",
                borderRadius: 11,
                background: "var(--red)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13.5,
                opacity:
                  isBusy || confirmation.trim().toUpperCase() !== DELETE_CONFIRMATION ? 0.5 : 1,
              }}
            >
              {isBusy ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setConfirmation("");
                setError(null);
              }}
              disabled={isBusy}
              style={{
                padding: "10px 16px",
                borderRadius: 11,
                color: "var(--muted)",
                fontWeight: 700,
                fontSize: 13.5,
                background: "transparent",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" style={{ marginTop: 12, fontSize: 13, color: "var(--red)" }}>
          {error}
        </p>
      )}
    </section>
  );
}
