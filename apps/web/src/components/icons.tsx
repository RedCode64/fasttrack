/** The design's icon set, ported path-for-path from FastTrack Dashboard.dc.html. */

type PathSpec = readonly (readonly ["path", string] | readonly ["circle", number, number, number])[];

const ICONS = {
  home: [["path", "M3 10.5 12 4l9 6.5"], ["path", "M5 9.5V20h14V9.5"]],
  spend: [["circle", 12, 12, 8], ["path", "M12 12V4"], ["path", "M12 12l6.5 4"]],
  budgets: [["circle", 12, 12, 8], ["circle", 12, 12, 3.4]],
  tips: [
    ["path", "M9.5 18h5"],
    ["path", "M10 21h4"],
    ["path", "M12 3a6 6 0 0 0-3.5 10.9c.6.5.8 1 .9 2.1h5.2c.1-1.1.3-1.6.9-2.1A6 6 0 0 0 12 3z"],
  ],
  revenue: [
    ["path", "M6 2.5h8l4 4V21H6z"],
    ["path", "M14 2.5V7h4"],
    ["path", "M9 12h6"],
    ["path", "M9 16h5"],
  ],
  profit: [["path", "M3 17l6-6 4 4 7-7"], ["path", "M17 8h4v4"]],
  jobs: [
    ["path", "M3 8.5h18V19H3z"],
    ["path", "M8.5 8.5V6.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2"],
    ["path", "M3 13h18"],
  ],
  clients: [["circle", 12, 8, 3.4], ["path", "M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"]],
  invoices: [
    ["path", "M6 2.5h8l4 4V21H6z"],
    ["path", "M14 2.5V7h4"],
    ["path", "M9 11h6"],
    ["path", "M9 15h4"],
  ],
  expenses: [["path", "M4 5h7l9 9-7 7-9-9z"], ["circle", 8, 9, 1]],
  reports: [
    ["path", "M5 20V11"],
    ["path", "M11 20V5"],
    ["path", "M17 20V14"],
    ["path", "M3 20h18"],
  ],
  settings: [
    ["path", "M4 8h10"],
    ["path", "M18 8h2"],
    ["path", "M4 16h6"],
    ["path", "M14 16h6"],
    ["circle", 16, 8, 2.2],
    ["circle", 12, 16, 2.2],
  ],
  search: [["circle", 11, 11, 7], ["path", "M21 21l-4.3-4.3"]],
  bell: [
    ["path", "M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"],
    ["path", "M10 20.5a2 2 0 0 0 4 0"],
  ],
  cal: [
    ["path", "M4 6h16v14H4z"],
    ["path", "M4 10h16"],
    ["path", "M8 3v4"],
    ["path", "M16 3v4"],
  ],
  chev: [["path", "M6 9l6 6 6-6"]],
  chevR: [["path", "M9 6l6 6-6 6"]],
  clock: [["circle", 12, 12, 8], ["path", "M12 8v4l3 2"]],
  download: [["path", "M12 4v11"], ["path", "M8 11l4 4 4-4"], ["path", "M5 20h14"]],
  over: [["path", "M12 3l9 16H3z"], ["path", "M12 10v4"], ["path", "M12 17h.01"]],
  cash: [["path", "M3 6h18v12H3z"], ["circle", 12, 12, 3]],
  lock: [["path", "M6 10.5h12V20H6z"], ["path", "M9 10.5V7.5a3 3 0 0 1 6 0v3"]],
} satisfies Record<string, PathSpec>;

export type IconName = keyof typeof ICONS | "bolt";

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  if (name === "bolt") {
    return (
      <svg width={size + 1} height={size + 1} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M13 2 4 13.5h6l-1 8.5 9-12h-6z" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name].map((spec, index) =>
        spec[0] === "path" ? (
          <path key={index} d={spec[1]} />
        ) : (
          <circle key={index} cx={spec[1]} cy={spec[2]} r={spec[3]} />
        ),
      )}
    </svg>
  );
}
