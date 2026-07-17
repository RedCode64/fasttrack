import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, spacing } from "@/theme";

export interface StatCardProps {
  readonly label: string;
  readonly value: string;
  readonly sub: string;
  readonly subColor: string;
}

/** One tile of the Home 2×2 KPI grid. */
export function StatCard({ label, value, sub, subColor }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={[styles.sub, { color: subColor }]}>{sub}</Text>
    </View>
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
  label: {
    fontSize: 11.5,
    fontFamily: fonts.sans600,
    color: colors.muted,
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
});
