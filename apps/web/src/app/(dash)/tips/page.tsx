import { basisPoints } from "@fasttrack/core";
import { Icon } from "@/components/icons";
import { monthKey } from "@/lib/format";
import { getOrgContext, loadDashboardData } from "@/lib/queries";
import { agingBuckets, budgetVsActual, buildTips, computeHealth } from "@/lib/rollups";

export default async function TipsPage() {
  const { orgId, org } = await getOrgContext();
  const data = await loadDashboardData(orgId);
  const now = new Date();

  const health = computeHealth(data, basisPoints(org.target_margin_bps), now);
  const aging = agingBuckets(data.invoices, now);
  const budgetLines = budgetVsActual(data.budgets, data.expenses, data.categories, monthKey(now));
  const tips = buildTips({
    budgetLines,
    aging,
    health,
    estimates: data.estimates,
    invoices: data.invoices,
  });

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ font: "700 29px/1.05 var(--font-jakarta)", letterSpacing: "-.025em" }}>
          Optimization Tips
        </h1>
        <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
          Every tip is computed from your live numbers — fix one and it disappears.
        </p>
      </div>

      <div style={{ display: "grid", gap: 13 }}>
        {tips.map((tip) => {
          const isWarn = tip.severity === "warn";
          return (
            <div
              key={tip.id}
              className="card"
              style={{
                padding: "17px 20px",
                display: "flex",
                gap: 15,
                borderLeft: `4px solid ${isWarn ? "var(--amber)" : "var(--green)"}`,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  flex: "none",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isWarn ? "var(--amber-bg)" : "var(--green-bg)",
                  color: isWarn ? "var(--amber)" : "var(--green)",
                }}
              >
                <Icon name={isWarn ? "over" : "tips"} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{tip.title}</div>
                <p style={{ marginTop: 5, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                  {tip.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
