import { basisPoints } from "@fasttrack/core";
import { ExpandableCard } from "@/components/ExpandableCard";
import { HealthGauge } from "@/components/HealthGauge";
import { money, monthKey, pct } from "@/lib/format";
import { getOrgContext, loadDashboardData } from "@/lib/queries";
import { agingBuckets, computeHealth, monthlySeries } from "@/lib/rollups";

type MonthPoint = { key: string; invoicedCents: number; collectedCents: number };

const HEALTH_WEIGHTS = { margin: 0.4, receivables: 0.3, collection: 0.3 } as const;

function DetailRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, padding: "3px 0" }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span style={{ fontWeight: 600, color: accent ?? "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

function RecentMonths({ series, field }: { series: MonthPoint[]; field: "invoicedCents" | "collectedCents" }) {
  const last = series.slice(-3);
  return (
    <>
      <div style={{ fontSize: 11.5, color: "var(--muted-2)", marginBottom: 4 }}>Last 3 months</div>
      {last.map((point) => (
        <DetailRow key={point.key} label={point.key} value={money(point[field])} />
      ))}
    </>
  );
}

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
    {
      label: "Outstanding",
      value: money(inputs.outstandingCents),
      sub: "open invoice balances",
      detail: (
        <>
          <DetailRow label="Not yet due" value={money(aging.notDueCents)} />
          <DetailRow label="1–30 days overdue" value={money(aging.d1to30Cents)} />
          <DetailRow label="31–60 days overdue" value={money(aging.d31to60Cents)} />
          <DetailRow
            label="61+ days overdue"
            value={money(aging.d61plusCents)}
            accent={aging.d61plusCents > 0 ? "var(--red)" : undefined}
          />
        </>
      ),
    },
    {
      label: "Overdue",
      value: money(overdueCents),
      sub: `${aging.overdueCount} invoice${aging.overdueCount === 1 ? "" : "s"} past due`,
      accent: overdueCents > 0 ? "var(--red)" : undefined,
      detail: (
        <>
          <DetailRow label="1–30 days" value={money(aging.d1to30Cents)} />
          <DetailRow label="31–60 days" value={money(aging.d31to60Cents)} />
          <DetailRow
            label="61+ days"
            value={money(aging.d61plusCents)}
            accent={aging.d61plusCents > 0 ? "var(--red)" : undefined}
          />
        </>
      ),
    },
    {
      label: "Invoiced this month",
      value: money(thisMonth?.invoicedCents ?? 0),
      sub: monthKey(now),
      detail: <RecentMonths series={series} field="invoicedCents" />,
    },
    {
      label: "Collected this month",
      value: money(thisMonth?.collectedCents ?? 0),
      sub: "cash in",
      accent: "var(--green)",
      detail: <RecentMonths series={series} field="collectedCents" />,
    },
  ];

  const drivers = [
    {
      label: "Margin",
      score: health.marginComponent,
      weight: HEALTH_WEIGHTS.margin,
      detail: `Realized ${pct(inputs.marginBps)} vs ${pct(inputs.targetMarginBps)} target`,
    },
    {
      label: "Receivables",
      score: health.receivablesComponent,
      weight: HEALTH_WEIGHTS.receivables,
      detail:
        inputs.outstandingCents === 0
          ? "Nothing outstanding"
          : `${money(overdueCents)} of ${money(inputs.outstandingCents)} is overdue`,
    },
    {
      label: "Collection",
      score: health.collectionComponent,
      weight: HEALTH_WEIGHTS.collection,
      detail: `${money(inputs.collectedCents)} collected on ${money(inputs.invoicedCents)} invoiced (90d)`,
    },
  ];

  const scoreColor = (value: number) =>
    value >= 70 ? "var(--green)" : value >= 55 ? "var(--amber)" : "var(--red)";

  const gaugeDetail = (
    <div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
        Score = 40% Margin + 30% Receivables + 30% Collection
      </div>
      <DetailRow
        label="Margin (40%)"
        value={`${health.marginComponent} → ${Math.round(health.marginComponent * HEALTH_WEIGHTS.margin)} pts`}
      />
      <DetailRow
        label="Receivables (30%)"
        value={`${health.receivablesComponent} → ${Math.round(health.receivablesComponent * HEALTH_WEIGHTS.receivables)} pts`}
      />
      <DetailRow
        label="Collection (30%)"
        value={`${health.collectionComponent} → ${Math.round(health.collectionComponent * HEALTH_WEIGHTS.collection)} pts`}
      />
      <div style={{ fontSize: 11.5, color: "var(--muted-2)", marginTop: 8 }}>
        Bands: ≥70 good · 55–69 watch · &lt;55 at risk
      </div>
    </div>
  );

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
          A single read on how the business is doing this month — tap any card to drill into
          what&apos;s driving it.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>
        <ExpandableCard
          ariaLabel="Health score breakdown"
          padding="22px 18px"
          summary={<HealthGauge health={health} />}
          detail={gaugeDetail}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {kpis.map((kpi) => (
            <ExpandableCard
              key={kpi.label}
              ariaLabel={`${kpi.label} breakdown`}
              summary={
                <>
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
                </>
              }
              detail={kpi.detail}
            />
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 16, alignItems: "start" }}>
        {drivers.map((driver) => (
          <ExpandableCard
            key={driver.label}
            ariaLabel={`${driver.label} breakdown`}
            summary={
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{driver.label}</span>
                  <span style={{ font: "800 19px/1 var(--font-jakarta)", color: scoreColor(driver.score) }}>
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
              </>
            }
            detail={
              <div>
                <p style={{ fontSize: 12.5, color: "var(--muted)" }}>{driver.detail}</p>
                <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted-2)" }}>
                  Weight {Math.round(driver.weight * 100)}% · contributes{" "}
                  {Math.round(driver.score * driver.weight)} pts to the {health.score} score
                </p>
              </div>
            }
          />
        ))}
      </div>
    </>
  );
}
