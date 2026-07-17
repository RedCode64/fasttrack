import Svg, { Path } from "react-native-svg";

import { colors } from "@/theme";

/** Stroke icons ported verbatim from the design's ic() map. */
const STROKE_PATHS = {
  home: ["M3 10.5 12 4l9 6.5", "M5 9.5V20h14V9.5"],
  doc: ["M6 3h8l4 4v14H6z", "M14 3v4h4", "M9 13h6", "M9 16h4"],
  receipt: ["M5 3h14v18l-3-2-2 2-2-2-2 2-3-2z", "M9 8h6", "M9 12h6"],
  wallet: ["M4 6h16v13H4z", "M4 9h16", "M16 13h2"],
  back: ["M15 5l-7 7 7 7"],
  plus: ["M12 5v14", "M5 12h14"],
  share: ["M12 3v13", "M8 7l4-4 4 4", "M6 11v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8"],
  check: ["M5 12.5l4.2 4.2L19 7"],
  alert: ["M12 3l9 16H3z", "M12 10v4", "M12 17h.01"],
  pdf: ["M7 3h7l4 4v14H7z", "M14 3v4h4"],
  cam: ["M4 8h3l1.5-2h7L17 8h3v11H4z", "M12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
} as const satisfies Record<string, readonly string[]>;

/** The one filled glyph (the FastTrack bolt). */
const BOLT_PATH = "M13 2 4 13.5h6l-1 8.5 9-12h-6z";

export type IconName = keyof typeof STROKE_PATHS | "bolt";

export interface IconProps {
  readonly name: IconName;
  readonly size?: number;
  readonly color?: string;
  readonly strokeWidth?: number;
}

export function Icon({ name, size = 18, color = colors.ink, strokeWidth }: IconProps) {
  if (name === "bolt") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={BOLT_PATH} fill={color} />
      </Svg>
    );
  }
  const sw = strokeWidth ?? (name === "check" ? 2.4 : 1.9);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {STROKE_PATHS[name].map((d) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
