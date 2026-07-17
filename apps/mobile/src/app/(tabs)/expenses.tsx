import { StyleSheet, Text, View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { colors, fonts, spacing } from "@/theme";

/** Placeholder — the expense list lands in plan group 7. */
export default function Expenses() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Expenses</Text>
      <EmptyState
        icon="wallet"
        title="No expenses yet"
        hint="Receipt capture arrives in build group 7."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBg,
    paddingTop: spacing.screenTop,
  },
  title: {
    fontSize: 27,
    fontFamily: fonts.sans700,
    letterSpacing: -0.8,
    color: colors.ink,
    paddingHorizontal: spacing.screenX,
  },
});
