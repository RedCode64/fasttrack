import { Icon } from "@/components/icons";
import { getOrgContext, loadDashboardData } from "@/lib/queries";

/** Minimal CSV writer: quotes everything, escapes embedded quotes. */
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\r\n");
}

function csvHref(rows: Record<string, unknown>[]): string {
  return "data:text/csv;charset=utf-8," + encodeURIComponent(toCsv(rows));
}

export default async function ReportsPage() {
  const { orgId } = await getOrgContext();
  const data = await loadDashboardData(orgId);

  const exports = [
    { name: "Invoices", file: "invoices.csv", rows: data.invoices as Record<string, unknown>[] },
    { name: "Payments", file: "payments.csv", rows: data.payments as Record<string, unknown>[] },
    { name: "Estimates", file: "estimates.csv", rows: data.estimates as Record<string, unknown>[] },
    { name: "Expenses", file: "expenses.csv", rows: data.expenses as Record<string, unknown>[] },
    { name: "Clients", file: "clients.csv", rows: data.clients as Record<string, unknown>[] },
    { name: "Jobs", file: "jobs.csv", rows: data.jobs as Record<string, unknown>[] },
  ];

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ font: "700 29px/1.05 var(--font-jakarta)", letterSpacing: "-.025em" }}>
          Reports &amp; Export
        </h1>
        <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
          Your data is yours — download any table as CSV for your accountant or spreadsheet.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {exports.map((item) => (
          <div key={item.name} className="card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14.5 }}>{item.name}</span>
              <span style={{ fontSize: 12, color: "var(--muted-2)", fontWeight: 600 }}>
                {item.rows.length} rows
              </span>
            </div>
            {item.rows.length === 0 ? (
              <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--muted-3)" }}>
                Nothing to export yet
              </p>
            ) : (
              <a
                href={csvHref(item.rows)}
                download={item.file}
                style={{
                  marginTop: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--green)",
                }}
              >
                <Icon name="download" size={16} /> Download CSV
              </a>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
