import type { HealthScore } from "@fasttrack/core";
import { useState } from "react";
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { HeroGradient } from "@/components/ui/HeroGradient";
import { colors, fonts, spacing } from "@/theme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

/** The Home hero: live decision-B gauge; tap to reveal the score's three drivers. */
export function HealthCard({ health }: { readonly health: HealthScore }) {
  const [open, setOpen] = useState(false);
  const sweep = CIRCUMFERENCE * (health.score / 100);

  const components = [
    { label: "Margin", weight: "40%", score: health.marginComponent },
    { label: "Receivables", weight: "30%", score: health.receivablesComponent },
    { label: "Collection", weight: "30%", score: health.collectionComponent },
  ] as const;

  return (
    <Pressable
      style={styles.card}
      onPress={() => {
        LayoutAnimation.easeInEaseOut();
        setOpen((value) => !value);
      }}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`Business health ${health.score}, ${BAND_TITLE[health.band]}. Tap for breakdown.`}
    >
      <HeroGradient gradientId="healthHeroGrad" />

      <View style={styles.row}>
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

        <Text style={[styles.chevron, open ? styles.chevronOpen : null]}>⌄</Text>
      </View>

      {open ? (
        <View style={styles.breakdown}>
          <Text style={styles.breakdownHint}>Score = 40% Margin + 30% Receivables + 30% Collection</Text>
          {components.map((component) => (
            <View key={component.label} style={styles.compRow}>
              <Text style={styles.compLabel}>
                {component.label} · {component.weight}
              </Text>
              <View style={styles.compTrack}>
                <View style={[styles.compFill, { width: `${component.score}%` }]} />
              </View>
              <Text style={styles.compScore}>{component.score}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.screenX,
    marginTop: 14,
    borderRadius: spacing.heroRadius,
    padding: 19,
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
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
    color: colors.white,
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
    color: colors.white,
  },
  summary: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.sans500,
    color: "rgba(255,255,255,0.75)",
    marginTop: 3,
  },
  chevron: {
    fontSize: 18,
    color: "rgba(255,255,255,0.75)",
    alignSelf: "flex-start",
  },
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  breakdown: {
    marginTop: 15,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.16)",
    gap: 9,
  },
  breakdownHint: {
    fontSize: 11,
    fontFamily: fonts.sans600,
    color: "rgba(255,255,255,0.6)",
  },
  compRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  compLabel: {
    width: 118,
    fontSize: 11.5,
    fontFamily: fonts.sans600,
    color: "rgba(255,255,255,0.85)",
  },
  compTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
  },
  compFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.mint,
  },
  compScore: {
    width: 26,
    textAlign: "right",
    fontSize: 12,
    fontFamily: fonts.mono700,
    color: colors.white,
  },
});
