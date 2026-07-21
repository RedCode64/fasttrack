import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { colors } from "@/theme";

/**
 * Opaque full-bleed screen background: the solid `glowBase` ground plus a
 * violet bloom top-right and a fainter blue one bottom-left — the premium
 * "Brandux" atmosphere. Rendered as the backmost layer INSIDE each screen (so
 * the screen is opaque and hides sibling tab screens) with the scroll content
 * painted transparent on top. Non-interactive, so it never intercepts touches.
 */
export function ScreenGlow() {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.glowBase }]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="glowViolet" cx="0.84" cy="0.02" r="0.85" fx="0.84" fy="0.02">
            <Stop offset="0" stopColor="#7b6cf0" stopOpacity="0.26" />
            <Stop offset="0.55" stopColor="#7b6cf0" stopOpacity="0.07" />
            <Stop offset="1" stopColor="#7b6cf0" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="glowBlue" cx="0.04" cy="1" r="0.8" fx="0.04" fy="1">
            <Stop offset="0" stopColor="#508cf7" stopOpacity="0.14" />
            <Stop offset="1" stopColor="#508cf7" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowViolet)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowBlue)" />
      </Svg>
    </View>
  );
}
