import { StatusPill } from "@/components/StatusPill";
import { longDate } from "@/lib/format";
import { getOrgContext, loadDashboardData } from "@/lib/queries";

export default async function JobsPage() {
  const { orgId } = await getOrgContext();
  const data = await loadDashboardData(orgId);
  const clientNames = new Map(data.clients.map((c) => [c.id, c.name]));
  const jobs = [...data.jobs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ font: "700 29px/1.05 var(--font-jakarta)", letterSpacing: "-.025em" }}>
          Jobs
        </h1>
        <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
          Every job the app has created — drafting an estimate is what brings one into existence.
        </p>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {jobs.length === 0 ? (
          <p style={{ padding: 24, color: "var(--muted)", fontSize: 13.5 }}>
            No jobs yet — draft your first estimate in the FastTrack app.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Client</th>
                <th>Address</th>
                <th>Status</th>
                <th className="num">Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td style={{ fontWeight: 700 }}>{job.title}</td>
                  <td style={{ color: "var(--muted)" }}>
                    {clientNames.get(job.client_id) ?? "—"}
                  </td>
                  <td style={{ color: "var(--muted)" }}>{job.address ?? "—"}</td>
                  <td>
                    <StatusPill status={job.status} />
                  </td>
                  <td className="num" style={{ color: "var(--muted)" }}>
                    {longDate(job.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
