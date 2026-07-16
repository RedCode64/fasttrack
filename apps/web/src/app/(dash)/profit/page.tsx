import { StatusPill } from "@/components/StatusPill";
import { money, pct } from "@/lib/format";
import { getOrgContext, loadDashboardData } from "@/lib/queries";
import { jobProfitability } from "@/lib/rollups";

export default async function JobProfitabilityPage() {
  const { orgId } = await getOrgContext();
  const data = await loadDashboardData(orgId);
  const rows = jobProfitability(data);

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ font: "700 29px/1.05 var(--font-jakarta)", letterSpacing: "-.025em" }}>
          Job Profitability
        </h1>
        <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
          Did each job actually make money — accepted work minus line costs and attributed
          expenses.
        </p>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {rows.length === 0 ? (
          <p style={{ padding: 24, color: "var(--muted)", fontSize: 13.5 }}>
            No accepted estimates or job expenses yet — profitability appears as soon as work is
            quoted and accepted in the app.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th className="num">Revenue</th>
                  <th className="num">Cost</th>
                  <th className="num">Profit</th>
                  <th className="num">Margin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.jobId}>
                    <td style={{ fontWeight: 700 }}>{row.title}</td>
                    <td style={{ color: "var(--muted)" }}>{row.clientName}</td>
                    <td>
                      <StatusPill status={row.status} />
                    </td>
                    <td className="num" style={{ fontWeight: 600 }}>
                      {money(row.revenueCents)}
                    </td>
                    <td className="num" style={{ color: "var(--muted)" }}>
                      {money(row.costCents)}
                    </td>
                    <td
                      className="num"
                      style={{
                        fontWeight: 800,
                        color: row.profitCents >= 0 ? "var(--green)" : "var(--red)",
                      }}
                    >
                      {money(row.profitCents)}
                    </td>
                    <td
                      className="num"
                      style={{
                        fontWeight: 700,
                        color: row.marginBps >= 0 ? "var(--ink)" : "var(--red)",
                      }}
                    >
                      {pct(row.marginBps)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
