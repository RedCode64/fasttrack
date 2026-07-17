import type { HealthScore } from "@fasttrack/core";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { colors, fonts, spacing } from "@/theme";

const RING_SIZE = 78;
const RING_STROKE = 10;
const RADIUS = (RING_SIZE - RING_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const BAND_TITLE: Record<HealthScore["band"], string> = {
  good: "Good",
  watch: "Watch",
  risk: "At risk",
};
const BAND_RING: Record<HealthScore["band"], string> = {
  good: colors.mint,
  watch: "#f2d38f",
  risk: "#f2a09b",
};

/** The Home hero: live decision-B gauge on the design's radial green card. */
export function HealthCard({ health }: { readonly health: HealthScore }) {
  const sweep = CIRCUMFERENCE * (health.score / 100);
  return (
    <View style={styles.card}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="heroGrad" cx="15%" cy="10%" rx="140%" ry="130%">
            <Stop offset="0" stopColor={colors.greenDeep} />
            <Stop offset="1" stopColor={colors.greenDark} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" rx={spacing.heroRadius} fill="url(#heroGrad)" />
      </Svg>

      <View style={styles.ringWrap}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={RING_STROKE}
            fill="transparent"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={BAND_RING[health.band]}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            fill="transparent"
            strokeDasharray={`${sweep} ${CIRCUMFERENCE}`}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <View style={styles.scoreBubble}>
          <Text style={styles.scoreText}>{health.score}</Text>
        </View>
      </View>

      <View style={styles.copy}>
        <Text style={styles.kicker}>Business health</Text>
        <Text style={styles.title}>{BAND_TITLE[health.band]}</Text>
        <Text style={styles.summary}>{health.summary}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.screenX,
    marginTop: 14,
    borderRadius: spacing.heroRadius,
    padding: 19,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    overflow: "hidden",
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreBubble: {
    position: "absolute",
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.greenDark,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    fontSize: 24,
    fontFamily: fonts.mono700,
    color: colors.surface,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    fontSize: 12,
    fontFamily: fonts.sans600,
    color: "rgba(255,255,255,0.7)",
  },
  title: {
    fontSize: 19,
    fontFamily: fonts.sans700,
    color: colors.surface,
  },
  summary: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.sans500,
    color: "rgba(255,255,255,0.75)",
    marginTop: 3,
  },
});
