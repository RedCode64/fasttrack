import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * Ambient background glow rendered once behind the whole app (in the root
 * layout): a violet bloom in the top-right and a fainter blue one in the
 * bottom-left, over the solid `glowBase` ground. Screens paint a transparent
 * background so this shows through in the gutters around cards — the premium
 * "Brandux" atmosphere. Non-interactive, so it never intercepts touches.
 */
export function ScreenGlow() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="glowViolet" cx="0.84" cy="0.02" r="0.85" fx="0.84" fy="0.02">
            <Stop offset="0" stopColor="#7b6cf0" stopOpacity="0.24" />
            <Stop offset="0.55" stopColor="#7b6cf0" stopOpacity="0.06" />
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
