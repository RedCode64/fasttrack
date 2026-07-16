/**
 * Design tokens ported from `FastTrack Mobile.dc.html` — the single source of
 * color/typography truth for the mobile app. Values are hex-for-hex from the
 * design; do not invent new ones here.
 */

export const colors = {
  /** Page behind the phone frame / behind sheets. */
  pageBg: "#e7ebe4",
  /** Every screen's scroll background. */
  screenBg: "#f4f6f2",
  surface: "#ffffff",
  ink: "#1c2622",
  slate: "#5c665f",
  gray: "#707b75",
  muted: "#8a938d",
  faint: "#a3aca6",
  dim: "#b3bab4",
  border: "#eceeea",
  borderCircle: "#e7ebe6",
  borderButton: "#d9ded6",
  hairline: "#f0f2ee",
  green: "#1c7c4e",
  greenDark: "#0f5233",
  greenDeep: "#1a6c44",
  mint: "#8ff0b6",
  greenWash: "#e9f4ec",
  red: "#cf4b4b",
  redWash: "#fbecec",
  amber: "#b9822a",
  amberWash: "#f6eeda",
  navy: "#17211c",
  blue: "#3a6ea5",
  blueWash: "#eaf0f6",
  teal: "#2b6f86",
  tealWash: "#e6f0f4",
  grayWash: "#eef0ec",
  tabInactive: "#9aa39c",
} as const;

/**
 * Loaded in the root layout via @expo-google-fonts; referenced by these
 * registered names everywhere else.
 */
export const fonts = {
  sans400: "PlusJakartaSans_400Regular",
  sans500: "PlusJakartaSans_500Medium",
  sans600: "PlusJakartaSans_600SemiBold",
  sans700: "PlusJakartaSans_700Bold",
  sans800: "PlusJakartaSans_800ExtraBold",
  mono500: "SpaceGrotesk_500Medium",
  mono600: "SpaceGrotesk_600SemiBold",
  mono700: "SpaceGrotesk_700Bold",
} as const;

export const spacing = {
  /** Horizontal screen padding used by every list/screen in the design. */
  screenX: 18,
  /** Top padding under the status bar for screen titles. */
  screenTop: 56,
  cardRadius: 16,
  cardRadiusSm: 15,
  heroRadius: 20,
  buttonRadius: 14,
} as const;

export interface PillTone {
  readonly bg: string;
  readonly fg: string;
}

/**
 * Status pill palette from the design's `pill()` map, keyed by our enum
 * values. `declined`/`expired` are not in the mock; they take the red/gray
 * treatments by analogy. "overdue" is a derived display status (never stored).
 */
export const statusPill: Record<string, PillTone> = {
  draft: { bg: "#eef0ec", fg: "#707b75" },
  sent: { bg: "#eaf0f6", fg: "#3a6ea5" },
  viewed: { bg: "#e6f0f4", fg: "#2b6f86" },
  accepted: { bg: "#e9f4ec", fg: "#1c7c4e" },
  declined: { bg: "#fbecec", fg: "#cf4b4b" },
  expired: { bg: "#eef0ec", fg: "#707b75" },
  partial: { bg: "#f6eeda", fg: "#b9822a" },
  paid: { bg: "#e9f4ec", fg: "#1c7c4e" },
  overdue: { bg: "#fbecec", fg: "#cf4b4b" },
};

/** Title-case label for a status pill ("in_progress" → "In progress"). */
export function statusLabel(status: string): string {
  const words = status.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
