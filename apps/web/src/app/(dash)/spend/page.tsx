import { money, monthKey, monthLabel } from "@/lib/format";
import { getOrgContext, loadDashboardData } from "@/lib/queries";
import { spendByCategory } from "@/lib/rollups";

const SEGMENT_COLORS = [
  "#1c7c4e",
  "#2ea36b",
  "#7cc09a",
  "#b9822a",
  "#3a6ea5",
  "#cf4b4b",
  "#707b75",
  "#a3aca6",
];

export default async function SpendPage() {
  const { orgId } = await getOrgContext();
  const data = await loadDashboardData(orgId);
  const month = monthKey(new Date());
  const { rows, totalCents } = spendByCategory(data.expenses, data.categories, month);

  // Donut geometry: r=62 ring on a 170×170 canvas, segments by share.
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments = rows.map((row, index) => {
    const share = totalCents === 0 ? 0 : row.cents / totalCents;
    const segment = {
      ...row,
      color: SEGMENT_COLORS[index % SEGMENT_COLORS.length]!,
      dash: share * circumference,
      offset,
      share,
    };
    offset += share * circumference;
    return segment;
  });

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ font: "700 29px/1.05 var(--font-jakarta)", letterSpacing: "-.025em" }}>
          Spend by Category
        </h1>
        <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
          Where {monthLabel(month)}&apos;s money actually went.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
        <div
          className="card"
          style={{ padding: 22, display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          <svg width={170} height={170} viewBox="0 0 170 170" role="img" aria-label="Spend donut">
            <circle cx={85} cy={85} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={20} />
            {segments.map((segment) => (
              <circle
                key={segment.categoryId}
                cx={85}
                cy={85}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={20}
                strokeDasharray={`${segment.dash.toFixed(2)} ${(circumference - segment.dash).toFixed(2)}`}
                strokeDashoffset={(-segment.offset).toFixed(2)}
                transform="rotate(-90 85 85)"
              />
            ))}
            <text
              x={85}
              y={82}
              textAnchor="middle"
              style={{ font: "800 21px var(--font-jakarta)", fill: "var(--ink)" }}
            >
              {money(totalCents)}
            </text>
            <text
              x={85}
              y={101}
              textAnchor="middle"
              style={{ font: "700 10px var(--font-jakarta)", fill: "var(--muted-2)", letterSpacing: ".08em" }}
            >
              THIS MONTH
            </text>
          </svg>
        </div>

        <div className="card" style={{ overflow: "hidden" }}>
          {rows.length === 0 ? (
            <p style={{ padding: 24, color: "var(--muted)", fontSize: 13.5 }}>
              No expenses recorded this month yet.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="num">Spent</th>
                  <th style={{ width: "42%" }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((segment) => (
                  <tr key={segment.categoryId}>
                    <td style={{ fontWeight: 600 }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 9,
                          height: 9,
                          borderRadius: "50%",
                          background: segment.color,
                          marginRight: 9,
                        }}
                      />
                      {segment.name}
                    </td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {money(segment.cents)}
                    </td>
                    <td>
                      <div
                        style={{
                          height: 7,
                          borderRadius: 6,
                          background: "var(--surface-2)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${(segment.share * 100).toFixed(1)}%`,
                            height: "100%",
                            background: segment.color,
                            borderRadius: 6,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
