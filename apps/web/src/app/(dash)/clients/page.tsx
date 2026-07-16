import { money } from "@/lib/format";
import { getOrgContext, loadDashboardData } from "@/lib/queries";

const OPEN_STATUSES = new Set(["sent", "viewed", "partial", "overdue"]);

export default async function ClientsPage() {
  const { orgId } = await getOrgContext();
  const data = await loadDashboardData(orgId);

  const jobClient = new Map(data.jobs.map((job) => [job.id, job.client_id]));
  const openByClient = new Map<string, number>();
  const jobsByClient = new Map<string, number>();

  for (const job of data.jobs) {
    jobsByClient.set(job.client_id, (jobsByClient.get(job.client_id) ?? 0) + 1);
  }
  for (const invoice of data.invoices) {
    if (!OPEN_STATUSES.has(invoice.status)) continue;
    const clientId = jobClient.get(invoice.job_id);
    if (!clientId) continue;
    openByClient.set(
      clientId,
      (openByClient.get(clientId) ?? 0) + Math.max(0, invoice.balance_cents),
    );
  }

  const clients = [...data.clients].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ font: "700 29px/1.05 var(--font-jakarta)", letterSpacing: "-.025em" }}>
          Clients
        </h1>
        <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
          Who you work for, and who still owes you.
        </p>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {clients.length === 0 ? (
          <p style={{ padding: 24, color: "var(--muted)", fontSize: 13.5 }}>
            No clients yet — they&apos;re added with your first estimate in the app.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Email</th>
                <th>Phone</th>
                <th className="num">Jobs</th>
                <th className="num">Open balance</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const open = openByClient.get(client.id) ?? 0;
                return (
                  <tr key={client.id}>
                    <td style={{ fontWeight: 700 }}>{client.name}</td>
                    <td style={{ color: "var(--muted)" }}>{client.email ?? "—"}</td>
                    <td style={{ color: "var(--muted)" }}>{client.phone ?? "—"}</td>
                    <td className="num">{jobsByClient.get(client.id) ?? 0}</td>
                    <td
                      className="num"
                      style={{
                        fontWeight: 700,
                        color: open > 0 ? "var(--amber)" : "var(--muted)",
                      }}
                    >
                      {money(open)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
