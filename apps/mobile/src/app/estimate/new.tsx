import { StyleSheet, View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { colors } from "@/theme";

/** Stub route — the new-estimate flow lands in plan group 5. */
export default function NewEstimate() {
  return (
    <View style={styles.screen}>
      <EmptyState
        icon="doc"
        title="New estimate"
        hint="The builder arrives in build group 5."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBg,
    justifyContent: "center",
  },
});
