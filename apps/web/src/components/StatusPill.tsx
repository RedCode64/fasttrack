/** Status pills, colors verbatim from the design's statPill(). */

const PILL_STYLES: Record<string, [string, string]> = {
  Paid: ["#e9f4ec", "#1c7c4e"],
  Sent: ["#e6f0f4", "#2b6f86"],
  Viewed: ["#eaf0f6", "#3a6ea5"],
  Partial: ["#f6eeda", "#b9822a"],
  Draft: ["#eef0ec", "#707b75"],
  Overdue: ["#fbecec", "#cf4b4b"],
  Accepted: ["#e9f4ec", "#1c7c4e"],
  Declined: ["#fbecec", "#cf4b4b"],
  Expired: ["#eef0ec", "#707b75"],
  "In progress": ["#eaf0f6", "#3a6ea5"],
  Lead: ["#eef0ec", "#707b75"],
  Quoted: ["#eaf0f6", "#3a6ea5"],
  Complete: ["#e9f4ec", "#1c7c4e"],
  Lost: ["#fbecec", "#cf4b4b"],
};

const FALLBACK: [string, string] = ["#eef0ec", "#707b75"];

/** DB enum value (e.g. "in_progress") → display label (e.g. "In progress"). */
export function statusLabel(status: string): string {
  const spaced = status.replaceAll("_", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function StatusPill({ status }: { status: string }) {
  const label = statusLabel(status);
  const [background, color] = PILL_STYLES[label] ?? FALLBACK;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 11px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        background,
        color,
      }}
    >
      {label}
    </span>
  );
}
