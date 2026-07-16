import { StatusPill } from "@/components/StatusPill";
import { moneyExact, shortDate } from "@/lib/format";
import { getOrgContext, loadDashboardData } from "@/lib/queries";

export default async function InvoicesPage() {
  const { orgId } = await getOrgContext();
  const data = await loadDashboardData(orgId);

  const jobTitle = new Map(data.jobs.map((job) => [job.id, job.title]));
  const jobClient = new Map(data.jobs.map((job) => [job.id, job.client_id]));
  const clientNames = new Map(data.clients.map((c) => [c.id, c.name]));

  const invoices = [...data.invoices].sort((a, b) => {
    const at = a.issued_at ?? a.created_at;
    const bt = b.issued_at ?? b.created_at;
    return new Date(bt).getTime() - new Date(at).getTime();
  });

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ font: "700 29px/1.05 var(--font-jakarta)", letterSpacing: "-.025em" }}>
          Invoices
        </h1>
        <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
          Everything billed, with what&apos;s still open on each.
        </p>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {invoices.length === 0 ? (
          <p style={{ padding: 24, color: "var(--muted)", fontSize: 13.5 }}>
            No invoices yet — convert an accepted estimate in the FastTrack app.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Client · Job</th>
                  <th>Issued</th>
                  <th>Due</th>
                  <th className="num">Total</th>
                  <th className="num">Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const clientId = jobClient.get(invoice.job_id);
                  return (
                    <tr key={invoice.id}>
                      <td style={{ fontWeight: 800 }}>INV-{invoice.number}</td>
                      <td>
                        <span style={{ fontWeight: 700 }}>
                          {clientId ? (clientNames.get(clientId) ?? "—") : "—"}
                        </span>
                        <span style={{ color: "var(--muted)" }}>
                          {" "}
                          · {jobTitle.get(invoice.job_id) ?? "—"}
                        </span>
                      </td>
                      <td style={{ color: "var(--muted)" }}>
                        {invoice.issued_at ? shortDate(invoice.issued_at) : "—"}
                      </td>
                      <td style={{ color: "var(--muted)" }}>
                        {invoice.due_at ? shortDate(invoice.due_at) : "—"}
                      </td>
                      <td className="num" style={{ fontWeight: 600 }}>
                        {moneyExact(invoice.total_cents)}
                      </td>
                      <td
                        className="num"
                        style={{
                          fontWeight: 700,
                          color: invoice.balance_cents > 0 ? "var(--ink)" : "var(--green)",
                        }}
                      >
                        {moneyExact(invoice.balance_cents)}
                      </td>
                      <td>
                        <StatusPill status={invoice.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
