import { useState } from "react";
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";

import { colors, fonts, spacing } from "@/theme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface StatDetailRow {
  readonly label: string;
  readonly value: string;
}

export interface StatCardProps {
  readonly label: string;
  readonly value: string;
  readonly sub: string;
  readonly subColor: string;
  /** When present, the tile becomes tappable and reveals these rows. */
  readonly detail?: readonly StatDetailRow[];
}

/** One tile of the Home 2×2 KPI grid; taps open a small breakdown when detail is supplied. */
export function StatCard({ label, value, sub, subColor, detail }: StatCardProps) {
  const [open, setOpen] = useState(false);
  const expandable = detail !== undefined && detail.length > 0;

  const body = (
    <>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {expandable ? (
          <Text style={[styles.chevron, open ? styles.chevronOpen : null]}>⌄</Text>
        ) : null}
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={[styles.sub, { color: subColor }]}>{sub}</Text>
      {expandable && open ? (
        <View style={styles.detail}>
          {detail.map((row) => (
            <View key={row.label} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{row.label}</Text>
              <Text style={styles.detailValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );

  if (!expandable) {
    return <View style={styles.card}>{body}</View>;
  }

  return (
    <Pressable
      style={styles.card}
      onPress={() => {
        LayoutAnimation.easeInEaseOut();
        setOpen((value) => !value);
      }}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${label} ${value}. Tap for detail.`}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.cardRadiusSm,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 11.5,
    fontFamily: fonts.sans600,
    color: colors.muted,
  },
  chevron: {
    fontSize: 14,
    color: colors.faint,
    marginTop: -2,
  },
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  value: {
    fontSize: 21,
    fontFamily: fonts.mono700,
    color: colors.ink,
    marginTop: 4,
  },
  sub: {
    fontSize: 11,
    fontFamily: fonts.sans600,
    marginTop: 3,
  },
  detail: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 5,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  detailLabel: {
    fontSize: 11.5,
    fontFamily: fonts.sans500,
    color: colors.muted,
  },
  detailValue: {
    fontSize: 11.5,
    fontFamily: fonts.mono700,
    color: colors.ink,
  },
});
