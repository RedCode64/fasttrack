import { StyleSheet, Text, View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { colors, fonts, spacing } from "@/theme";

/** Placeholder — the invoice list lands in plan group 6. */
export default function Invoices() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Invoices</Text>
      <EmptyState
        icon="receipt"
        title="No invoices yet"
        hint="Convert an accepted estimate — the list arrives in build group 6."
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
