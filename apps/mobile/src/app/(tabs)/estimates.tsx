import { StyleSheet, Text, View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { colors, fonts, spacing } from "@/theme";

/** Placeholder — the pipeline list lands in plan group 5. */
export default function Estimates() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Estimates</Text>
      <EmptyState
        icon="doc"
        title="No estimates yet"
        hint="The pipeline list arrives in build group 5."
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
