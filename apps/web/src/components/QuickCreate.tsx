"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createBudget,
  createClientRecord,
  createExpense,
  createJob,
  type ActionResult,
} from "@/lib/actions";
import type { NamedOption } from "@/lib/queries";

export type CreatableKind = "client" | "job" | "expense" | "budget";

const KIND_TITLE: Record<CreatableKind, string> = {
  client: "New client",
  job: "New job",
  expense: "New expense",
  budget: "New budget",
};

const JOB_STATUSES: readonly string[] = ["lead", "quoted", "in_progress", "complete", "lost"];

interface QuickCreateProps {
  label: string;
  kinds: CreatableKind[];
  clients: NamedOption[];
  categories: NamedOption[];
}

function buildInput(kind: CreatableKind, fd: FormData): Record<string, unknown> {
  const get = (key: string) => ((fd.get(key) as string | null) ?? "").trim();
  switch (kind) {
    case "client":
      return { name: get("name"), email: get("email"), phone: get("phone"), address: get("address"), notes: get("notes") };
    case "job":
      return {
        title: get("title"),
        client_id: get("client_id"),
        status: get("status") || "lead",
        address: get("address"),
        scheduled_at: get("scheduled_at"),
        notes: get("notes"),
      };
    case "expense":
      return {
        category_id: get("category_id"),
        amount: get("amount"),
        spent_at: get("spent_at"),
        vendor: get("vendor"),
        description: get("description"),
        is_billable: fd.get("is_billable") === "on",
      };
    case "budget":
      return { category_id: get("category_id"), month: get("month"), amount: get("amount") };
  }
}

function runAction(kind: CreatableKind, input: Record<string, unknown>): Promise<ActionResult> {
  switch (kind) {
    case "client":
      return createClientRecord(input);
    case "job":
      return createJob(input);
    case "expense":
      return createExpense(input);
    case "budget":
      return createBudget(input);
  }
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  fontSize: 13.5,
  fontFamily: "inherit",
  color: "var(--ink)",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 9,
  marginTop: 5,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted-2)" }}>
      {label}
      {children}
    </label>
  );
}

export function QuickCreate({ label, kinds, clients, categories }: QuickCreateProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<CreatableKind>(kinds[0]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);

  function launch() {
    setActive(kinds[0]);
    setError(null);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = buildInput(active, new FormData(e.currentTarget));
    setError(null);
    startTransition(async () => {
      const result = await runAction(active, input);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const needsClient = active === "job" && clients.length === 0;
  const needsCategory = (active === "expense" || active === "budget") && categories.length === 0;
  const blocked = needsClient || needsCategory;

  return (
    <>
      <button
        type="button"
        onClick={launch}
        aria-label={`Create in ${label}`}
        title={`Create in ${label}`}
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--muted-2)",
          fontSize: 16,
          lineHeight: 1,
          background: "var(--surface-2)",
        }}
      >
        +
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={KIND_TITLE[active]}
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(20, 28, 24, 0.42)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "8vh 16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ width: "100%", maxWidth: 440, padding: 22, cursor: "auto" }}
          >
            <h2 style={{ font: "700 18px/1 var(--font-jakarta)", marginBottom: 14 }}>
              {KIND_TITLE[active]}
            </h2>

            {kinds.length > 1 && (
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {kinds.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      setActive(kind);
                      setError(null);
                    }}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12.5,
                      fontWeight: 700,
                      borderRadius: 8,
                      background: kind === active ? "var(--green-bg)" : "var(--surface-2)",
                      color: kind === active ? "var(--green-dark)" : "var(--muted)",
                    }}
                  >
                    {KIND_TITLE[kind].replace("New ", "")}
                  </button>
                ))}
              </div>
            )}

            {blocked ? (
              <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5 }}>
                {needsClient
                  ? "Add a client first — jobs need a client to belong to."
                  : "No expense categories exist yet."}
              </p>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
                {active === "client" && (
                  <>
                    <Field label="Name">
                      <input name="name" required autoFocus style={fieldStyle} />
                    </Field>
                    <Field label="Email">
                      <input name="email" type="email" style={fieldStyle} />
                    </Field>
                    <Field label="Phone">
                      <input name="phone" type="tel" style={fieldStyle} />
                    </Field>
                    <Field label="Address">
                      <input name="address" style={fieldStyle} />
                    </Field>
                    <Field label="Notes">
                      <textarea name="notes" rows={2} style={fieldStyle} />
                    </Field>
                  </>
                )}

                {active === "job" && (
                  <>
                    <Field label="Title">
                      <input name="title" required autoFocus style={fieldStyle} />
                    </Field>
                    <Field label="Client">
                      <select name="client_id" required defaultValue="" style={fieldStyle}>
                        <option value="" disabled>
                          Select a client…
                        </option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Status">
                      <select name="status" defaultValue="lead" style={fieldStyle}>
                        {JOB_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Address">
                      <input name="address" style={fieldStyle} />
                    </Field>
                    <Field label="Scheduled date">
                      <input name="scheduled_at" type="date" style={fieldStyle} />
                    </Field>
                    <Field label="Notes">
                      <textarea name="notes" rows={2} style={fieldStyle} />
                    </Field>
                  </>
                )}

                {active === "expense" && (
                  <>
                    <Field label="Category">
                      <select name="category_id" required defaultValue="" style={fieldStyle}>
                        <option value="" disabled>
                          Select a category…
                        </option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Amount ($)">
                      <input name="amount" inputMode="decimal" required autoFocus style={fieldStyle} />
                    </Field>
                    <Field label="Date">
                      <input name="spent_at" type="date" defaultValue={today} required style={fieldStyle} />
                    </Field>
                    <Field label="Vendor">
                      <input name="vendor" style={fieldStyle} />
                    </Field>
                    <Field label="Description">
                      <input name="description" style={fieldStyle} />
                    </Field>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
                      <input name="is_billable" type="checkbox" /> Billable to client
                    </label>
                  </>
                )}

                {active === "budget" && (
                  <>
                    <Field label="Category">
                      <select name="category_id" required defaultValue="" style={fieldStyle}>
                        <option value="" disabled>
                          Select a category…
                        </option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Month">
                      <input name="month" type="month" defaultValue={thisMonth} required style={fieldStyle} />
                    </Field>
                    <Field label="Budget amount ($)">
                      <input name="amount" inputMode="decimal" required autoFocus style={fieldStyle} />
                    </Field>
                  </>
                )}

                {error && (
                  <p style={{ fontSize: 12.5, color: "var(--red)", background: "var(--red-bg)", padding: "8px 11px", borderRadius: 8 }}>
                    {error}
                  </p>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    style={{ padding: "9px 15px", fontSize: 13, fontWeight: 700, color: "var(--muted)", borderRadius: 9 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    style={{
                      padding: "9px 17px",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#fff",
                      background: "var(--green)",
                      borderRadius: 9,
                      opacity: isPending ? 0.65 : 1,
                    }}
                  >
                    {isPending ? "Saving…" : "Create"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
