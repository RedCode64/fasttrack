import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { colors } from "@/theme";

interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * The green radial fill behind the Home health card and the estimate hero.
 *
 * Drawn at a measured pixel size rather than `100%`: inside a container whose
 * height comes from its children, react-native-svg resolves a percentage
 * viewport against a size it does not reliably know on the first layout pass,
 * which left the fill sitting off the card it was meant to cover. A solid
 * ground underneath keeps the surface correct for the frame before `onLayout`
 * reports, and the parent's `borderRadius` + `overflow: "hidden"` does the
 * corner clipping so the rect itself needs no radius.
 *
 * `gradientId` must be unique per mounted instance — SVG gradient ids share one
 * document namespace.
 */
export function HeroGradient({ gradientId }: { readonly gradientId: string }) {
  const [size, setSize] = useState<Size | null>(null);

  const measure = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) =>
      previous && previous.width === width && previous.height === height
        ? previous
        : { width, height },
    );
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.ground]} onLayout={measure}>
      {size ? (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <RadialGradient id={gradientId} cx="15%" cy="10%" rx="140%" ry="130%">
              <Stop offset="0" stopColor={colors.greenDeep} />
              <Stop offset="1" stopColor={colors.greenDark} />
            </RadialGradient>
          </Defs>
          <Rect width={size.width} height={size.height} fill={`url(#${gradientId})`} />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ground: {
    backgroundColor: colors.greenDeep,
    // Decorative fill only — taps belong to the card underneath it.
    pointerEvents: "none",
  },
});
