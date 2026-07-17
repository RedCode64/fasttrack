import { useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { colors } from "@/theme";

/** Stub route — the invoice detail lands in plan group 6. */
export default function InvoiceDetailScreen() {
  useLocalSearchParams<{ id: string }>();
  return (
    <View style={styles.screen}>
      <EmptyState
        icon="receipt"
        title="Invoice"
        hint="The invoice detail arrives in build group 6."
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
