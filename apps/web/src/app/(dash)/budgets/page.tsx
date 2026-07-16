import { money, monthKey, monthLabel } from "@/lib/format";
import { getOrgContext, loadDashboardData } from "@/lib/queries";
import { budgetVsActual } from "@/lib/rollups";

export default async function BudgetsPage() {
  const { orgId } = await getOrgContext();
  const data = await loadDashboardData(orgId);
  const month = monthKey(new Date());
  const lines = budgetVsActual(data.budgets, data.expenses, data.categories, month);

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ font: "700 29px/1.05 var(--font-jakarta)", letterSpacing: "-.025em" }}>
          Budgets
        </h1>
        <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
          {monthLabel(month)} spending against what you planned, category by category.
        </p>
      </div>

      {lines.length === 0 ? (
        <div className="card" style={{ padding: 26 }}>
          <p style={{ color: "var(--muted)", fontSize: 13.5 }}>
            No budgets set for this month yet — budgets are managed in the FastTrack app.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {lines.map((line) => {
            const hasBudget = line.budgetCents > 0;
            const ratio = hasBudget ? line.actualCents / line.budgetCents : 0;
            const isOver = hasBudget && line.actualCents > line.budgetCents;
            const barColor = isOver ? "var(--red)" : "var(--green)";
            const remaining = line.budgetCents - line.actualCents;

            return (
              <div key={line.categoryId} className="card" style={{ padding: "17px 20px" }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}
                >
                  <span style={{ fontWeight: 700, fontSize: 14.5 }}>{line.name}</span>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    <strong style={{ color: "var(--ink)", fontWeight: 800 }}>
                      {money(line.actualCents)}
                    </strong>
                    {hasBudget ? ` of ${money(line.budgetCents)}` : " spent (no budget set)"}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 11,
                    height: 9,
                    borderRadius: 6,
                    background: "var(--surface-2)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: hasBudget ? `${Math.min(100, ratio * 100).toFixed(1)}%` : "100%",
                      height: "100%",
                      borderRadius: 6,
                      background: hasBudget ? barColor : "var(--muted-3)",
                    }}
                  />
                </div>
                <div style={{ marginTop: 9, fontSize: 12.5, fontWeight: 600 }}>
                  {hasBudget ? (
                    isOver ? (
                      <span style={{ color: "var(--red)" }}>
                        {money(-remaining)} over budget
                      </span>
                    ) : (
                      <span style={{ color: "var(--green)" }}>
                        {money(remaining)} left this month
                      </span>
                    )
                  ) : (
                    <span style={{ color: "var(--muted-2)" }}>Set a budget to track this</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
