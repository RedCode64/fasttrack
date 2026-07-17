/** Instant skeleton shown while a dashboard screen's server render is in flight. */
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ animation: "fadeUp .18s ease" }}>
      <div
        style={{
          width: 220,
          height: 13,
          borderRadius: 6,
          background: "var(--surface-2)",
          marginBottom: 10,
        }}
      />
      <div
        style={{
          width: 320,
          height: 26,
          borderRadius: 8,
          background: "var(--surface-2)",
          marginBottom: 24,
        }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="card skeleton-pulse"
            style={{ height: 120, background: "var(--surface-2)" }}
          />
        ))}
      </div>
    </div>
  );
}
