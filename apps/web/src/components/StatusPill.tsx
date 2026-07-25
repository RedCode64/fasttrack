/**
 * Status pills, toned for the dark theme: a translucent colored wash under a
 * brightened foreground. Values mirror `statusPill` in the mobile app's
 * `src/theme.ts` so a status reads identically on both surfaces. The five job
 * statuses mobile doesn't define (Lead, Quoted, In progress, Complete, Lost)
 * reuse the same tones by semantic group — neutral, blue, green, red.
 */

const NEUTRAL: [string, string] = ["rgba(255,255,255,0.08)", "#a4a9bf"];
const BLUE: [string, string] = ["rgba(92,147,245,0.16)", "#8fb4f8"];
const TEAL: [string, string] = ["rgba(63,176,201,0.16)", "#6fd0e4"];
const GREEN: [string, string] = ["rgba(79,208,122,0.16)", "#6fe09a"];
const RED: [string, string] = ["rgba(255,107,125,0.16)", "#ff8a98"];
const AMBER: [string, string] = ["rgba(242,179,80,0.16)", "#f2c268"];

const PILL_STYLES: Record<string, [string, string]> = {
  Paid: GREEN,
  Sent: BLUE,
  Viewed: TEAL,
  Partial: AMBER,
  Draft: NEUTRAL,
  Overdue: RED,
  Accepted: GREEN,
  Declined: RED,
  Expired: NEUTRAL,
  "In progress": BLUE,
  Lead: NEUTRAL,
  Quoted: BLUE,
  Complete: GREEN,
  Lost: RED,
};

const FALLBACK: [string, string] = NEUTRAL;

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
