/**
 * Design tokens for the FastTrack "Brandux" dark theme — a premium, glass-card
 * dark UI: deep indigo-charcoal grounds, violet as the interactive accent, and
 * green kept for positive / success semantics. Screens theme through these
 * tokens, so the palette lives here (hex-for-hex) and nowhere else.
 *
 * Token roles worth knowing:
 *  - `surface`      → dark card / input BACKGROUND
 *  - `white`        → foreground (text/icon) that sits ON a colored fill
 *  - `accent`/`navy`→ violet interactive accent (primary buttons, active pills,
 *                      active tabs). `navy` is kept as an alias so existing
 *                      "active fill" styles resolve to the accent automatically.
 *  - `green` family → positive / paid / success only.
 */

export const colors = {
  /** Deepest ground, behind sheets. */
  pageBg: "#0b0c15",
  /** Solid base painted behind the ambient glow (see ScreenGlow). */
  glowBase: "#0b0c16",
  /** Screen scroll background — transparent so the root ambient glow shows
   *  through every screen. The solid ground comes from `glowBase` at the root. */
  screenBg: "transparent",
  /** Recessed field background inside a card (darker than `surface`). */
  field: "#13152a",
  /** Card / input background. */
  surface: "#1b1d31",
  /** Elevated / pressed surface. */
  surface2: "#242743",
  /** Foreground on colored fills (was the old white `surface`). */
  white: "#ffffff",
  ink: "#f4f5fb",
  slate: "#c4c8d8",
  gray: "#a4a9bf",
  muted: "#8b90a7",
  faint: "#6c7189",
  dim: "#565b74",
  border: "rgba(255,255,255,0.07)",
  borderCircle: "rgba(255,255,255,0.09)",
  borderButton: "rgba(255,255,255,0.13)",
  hairline: "rgba(255,255,255,0.06)",

  /** Violet interactive accent. */
  accent: "#7b6cf0",
  accentDeep: "#6a58e6",
  accentWash: "rgba(123,108,240,0.16)",
  /** Alias so existing `colors.navy` active-fill styles become the accent. */
  navy: "#7b6cf0",

  /** Positive / success / paid. */
  green: "#4fd07a",
  greenDark: "#2fae5f",
  greenDeep: "#1f7d47",
  mint: "#8ff0b6",
  greenWash: "rgba(79,208,122,0.15)",

  red: "#ff6b7d",
  redWash: "rgba(255,107,125,0.15)",
  amber: "#f2b350",
  amberWash: "rgba(242,179,80,0.15)",
  blue: "#5c93f5",
  blueWash: "rgba(92,147,245,0.15)",
  teal: "#3fb0c9",
  tealWash: "rgba(63,176,201,0.15)",
  grayWash: "rgba(255,255,255,0.08)",
  tabInactive: "#6c7189",
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
  cardRadius: 18,
  cardRadiusSm: 16,
  heroRadius: 22,
  buttonRadius: 14,
} as const;

export interface PillTone {
  readonly bg: string;
  readonly fg: string;
}

/**
 * Status pill palette tuned for dark cards: a translucent colored wash under a
 * brightened foreground. "overdue" is a derived display status (never stored).
 */
export const statusPill: Record<string, PillTone> = {
  draft: { bg: "rgba(255,255,255,0.08)", fg: "#a4a9bf" },
  sent: { bg: "rgba(92,147,245,0.16)", fg: "#8fb4f8" },
  viewed: { bg: "rgba(63,176,201,0.16)", fg: "#6fd0e4" },
  accepted: { bg: "rgba(79,208,122,0.16)", fg: "#6fe09a" },
  declined: { bg: "rgba(255,107,125,0.16)", fg: "#ff8a98" },
  expired: { bg: "rgba(255,255,255,0.08)", fg: "#a4a9bf" },
  partial: { bg: "rgba(242,179,80,0.16)", fg: "#f2c268" },
  paid: { bg: "rgba(79,208,122,0.16)", fg: "#6fe09a" },
  overdue: { bg: "rgba(255,107,125,0.16)", fg: "#ff8a98" },
};

/** Title-case label for a status pill ("in_progress" → "In progress"). */
export function statusLabel(status: string): string {
  const words = status.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
