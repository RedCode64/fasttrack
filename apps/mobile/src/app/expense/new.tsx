import { StyleSheet, View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { colors } from "@/theme";

/** Stub route — the capture form lands in plan group 7. */
export default function NewExpense() {
  return (
    <View style={styles.screen}>
      <EmptyState
        icon="cam"
        title="New expense"
        hint="Receipt capture arrives in build group 7."
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
