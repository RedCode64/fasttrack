import { basisPoints } from "@fasttrack/core";
import { HealthGauge } from "@/components/HealthGauge";
import { money, monthKey, pct } from "@/lib/format";
import { getOrgContext, loadDashboardData } from "@/lib/queries";
import { agingBuckets, computeHealth, monthlySeries } from "@/lib/rollups";

export default async function FinancialPositionPage() {
  const { orgId, org } = await getOrgContext();
  const data = await loadDashboardData(orgId);
  const now = new Date();

  const healthResult = computeHealth(data, basisPoints(org.target_margin_bps), now);
  const { health, inputs } = healthResult;
  const series = monthlySeries(data.invoices, data.payments, now);
  const thisMonth = series[series.length - 1];
  const aging = agingBuckets(data.invoices, now);
  const overdueCents = aging.d1to30Cents + aging.d31to60Cents + aging.d61plusCents;

  const eyebrow = `${org.name.toUpperCase()} · ${now
    .toLocaleDateString("en-US", { month: "long", year: "numeric" })
    .toUpperCase()}`;

  const kpis = [
    { label: "Outstanding", value: money(inputs.outstandingCents), sub: "open invoice balances" },
    {
      label: "Overdue",
      value: money(overdueCents),
      sub: `${aging.overdueCount} invoice${aging.overdueCount === 1 ? "" : "s"} past due`,
      accent: overdueCents > 0 ? "var(--red)" : undefined,
    },
    {
      label: "Invoiced this month",
      value: money(thisMonth?.invoicedCents ?? 0),
      sub: monthKey(now),
    },
    {
      label: "Collected this month",
      value: money(thisMonth?.collectedCents ?? 0),
      sub: "cash in",
      accent: "var(--green)",
    },
  ];

  const drivers = [
    {
      label: "Margin",
      score: health.marginComponent,
      detail: `Realized ${pct(inputs.marginBps)} vs ${pct(inputs.targetMarginBps)} target`,
    },
    {
      label: "Receivables",
      score: health.receivablesComponent,
      detail:
        inputs.outstandingCents === 0
          ? "Nothing outstanding"
          : `${money(overdueCents)} of ${money(inputs.outstandingCents)} is overdue`,
    },
    {
      label: "Collection",
      score: health.collectionComponent,
      detail: `${money(inputs.collectedCents)} collected on ${money(inputs.invoicedCents)} invoiced (90d)`,
    },
  ];

  const scoreColor = (value: number) =>
    value >= 70 ? "var(--green)" : value >= 55 ? "var(--amber)" : "var(--red)";

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 12,
            color: "var(--muted-3)",
            letterSpacing: ".03em",
            marginBottom: 7,
          }}
        >
          {eyebrow}
        </div>
        <h1 style={{ font: "700 29px/1.05 var(--font-jakarta)", letterSpacing: "-.025em" }}>
          Financial Position
        </h1>
        <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
          A single read on how the business is doing this month — then drill into what&apos;s
          driving it.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
        <div className="card" style={{ padding: "22px 18px" }}>
          <HealthGauge health={health} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {kpis.map((kpi) => (
            <div key={kpi.label} className="card" style={{ padding: "18px 20px" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted-2)" }}>
                {kpi.label}
              </div>
              <div
                style={{
                  marginTop: 8,
                  font: "800 27px/1 var(--font-jakarta)",
                  letterSpacing: "-.02em",
                  color: kpi.accent ?? "var(--ink)",
                }}
              >
                {kpi.value}
              </div>
              <div style={{ marginTop: 7, fontSize: 12, color: "var(--muted)" }}>{kpi.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 16 }}>
        {drivers.map((driver) => (
          <div key={driver.label} className="card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{driver.label}</span>
              <span
                style={{
                  font: "800 19px/1 var(--font-jakarta)",
                  color: scoreColor(driver.score),
                }}
              >
                {driver.score}
              </span>
            </div>
            <div
              style={{
                marginTop: 12,
                height: 7,
                borderRadius: 6,
                background: "var(--surface-2)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${driver.score}%`,
                  height: "100%",
                  borderRadius: 6,
                  background: scoreColor(driver.score),
                }}
              />
            </div>
            <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--muted)" }}>{driver.detail}</p>
          </div>
        ))}
      </div>
    </>
  );
}
