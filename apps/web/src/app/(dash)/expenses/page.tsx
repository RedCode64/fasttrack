import { moneyExact, shortDate } from "@/lib/format";
import { getOrgContext, loadDashboardData } from "@/lib/queries";

export default async function ExpensesPage() {
  const { orgId } = await getOrgContext();
  const data = await loadDashboardData(orgId);

  const categoryNames = new Map(data.categories.map((c) => [c.id, c.name]));
  const jobTitles = new Map(data.jobs.map((job) => [job.id, job.title]));
  const expenses = [...data.expenses].sort((a, b) => b.spent_at.localeCompare(a.spent_at));

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ font: "700 29px/1.05 var(--font-jakarta)", letterSpacing: "-.025em" }}>
          Expenses
        </h1>
        <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
          Everything spent — attributed to jobs where it belongs, overhead where it doesn&apos;t.
        </p>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {expenses.length === 0 ? (
          <p style={{ padding: 24, color: "var(--muted)", fontSize: 13.5 }}>
            No expenses captured yet — snap receipts in the FastTrack app.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Vendor</th>
                  <th>Category</th>
                  <th>Job</th>
                  <th>Billable</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td style={{ color: "var(--muted)" }}>{shortDate(expense.spent_at)}</td>
                    <td style={{ fontWeight: 700 }}>{expense.vendor ?? "—"}</td>
                    <td style={{ color: "var(--muted)" }}>
                      {categoryNames.get(expense.category_id) ?? "—"}
                    </td>
                    <td style={{ color: "var(--muted)" }}>
                      {expense.job_id ? (jobTitles.get(expense.job_id) ?? "—") : "Overhead"}
                    </td>
                    <td>
                      {expense.is_billable ? (
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: "3px 9px",
                            borderRadius: 20,
                            background: "var(--green-bg)",
                            color: "var(--green)",
                          }}
                        >
                          Billable
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted-3)", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {moneyExact(expense.amount_cents)}
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
