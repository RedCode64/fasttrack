import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme";

/** Scaffold placeholder — replaced by the tab shell in plan group 4. */
export default function Placeholder() {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>⚡</Text>
      </View>
      <Text style={styles.title}>FastTrack</Text>
      <Text style={styles.subtitle}>Mobile scaffold — screens land in group 4</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.screenBg,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 20,
    color: colors.surface,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: colors.ink,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
  },
});
