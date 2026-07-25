import { money } from "@/lib/format";
import { getOrgContext, loadDashboardData } from "@/lib/queries";
import { agingBuckets, monthlySeries } from "@/lib/rollups";

const CHART = { width: 660, height: 190, top: 12, bottom: 26, left: 8 };

/**
 * Two-series categorical slots for the invoiced-vs-collected bars, validated
 * against the card surface: adjacent CVD ΔE 19.6, normal-vision ΔE 20.9, both
 * clear of the floors, and both inside the dark lightness band. The previous
 * pairing was two greens, which collapsed on a dark ground.
 */
const SERIES_INVOICED = "#3987e5";
const SERIES_COLLECTED = "#199e70";

export default async function RevenuePage() {
  const { orgId } = await getOrgContext();
  const data = await loadDashboardData(orgId);
  const now = new Date();

  const series = monthlySeries(data.invoices, data.payments, now);
  const aging = agingBuckets(data.invoices, now);
  const outstanding =
    aging.notDueCents + aging.d1to30Cents + aging.d31to60Cents + aging.d61plusCents;

  const max = Math.max(1, ...series.flatMap((p) => [p.invoicedCents, p.collectedCents]));
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const groupWidth = (CHART.width - CHART.left * 2) / series.length;
  const barWidth = 26;

  /**
   * Receivables aging is a good→critical status scale, not an arbitrary
   * categorical set, so it uses the reserved status steps rather than series
   * hues. Warning and serious sit close by design (ΔE 13.6 unsimulated); the
   * per-bucket text label beside each bar is what carries the distinction, so
   * these colors are never read alone.
   */
  const buckets = [
    { label: "Current", cents: aging.notDueCents, color: "#0ca30c" },
    { label: "1–30 days", cents: aging.d1to30Cents, color: "#fab219" },
    { label: "31–60 days", cents: aging.d31to60Cents, color: "#ec835a" },
    { label: "61+ days", cents: aging.d61plusCents, color: "#d03b3b" },
  ];

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ font: "700 29px/1.05 var(--font-jakarta)", letterSpacing: "-.025em" }}>
          Revenue &amp; Receivables
        </h1>
        <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
          What you billed, what actually arrived, and where the {money(outstanding)} outstanding
          sits.
        </p>
      </div>

      <div className="card" style={{ padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>Invoiced vs collected — 6 months</span>
          <span style={{ display: "flex", gap: 16, fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
            <span>
              <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: SERIES_INVOICED, marginRight: 6 }} />
              Invoiced
            </span>
            <span>
              <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: SERIES_COLLECTED, marginRight: 6 }} />
              Collected
            </span>
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <svg
            width={CHART.width}
            height={CHART.height}
            viewBox={`0 0 ${CHART.width} ${CHART.height}`}
            role="img"
            aria-label="Monthly invoiced versus collected"
            style={{ marginTop: 10, maxWidth: "100%" }}
          >
            {series.map((point, index) => {
              const groupX = CHART.left + index * groupWidth + groupWidth / 2;
              const invoicedHeight = (point.invoicedCents / max) * plotHeight;
              const collectedHeight = (point.collectedCents / max) * plotHeight;
              const baseline = CHART.top + plotHeight;
              return (
                <g key={point.key}>
                  <rect
                    x={groupX - barWidth - 3}
                    y={baseline - invoicedHeight}
                    width={barWidth}
                    height={Math.max(2, invoicedHeight)}
                    rx={5}
                    fill={SERIES_INVOICED}
                  />
                  <rect
                    x={groupX + 3}
                    y={baseline - collectedHeight}
                    width={barWidth}
                    height={Math.max(2, collectedHeight)}
                    rx={5}
                    fill={SERIES_COLLECTED}
                  />
                  <text
                    x={groupX}
                    y={CHART.height - 8}
                    textAnchor="middle"
                    style={{ font: "600 11px var(--font-jakarta)", fill: "var(--muted-2)" }}
                  >
                    {point.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 16 }}>
        {buckets.map((bucket) => (
          <div key={bucket.label} className="card" style={{ padding: "17px 20px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted-2)" }}>
              {bucket.label}
            </div>
            <div
              style={{
                marginTop: 8,
                font: "800 23px/1 var(--font-jakarta)",
                color: bucket.cents > 0 ? bucket.color : "var(--ink)",
              }}
            >
              {money(bucket.cents)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
