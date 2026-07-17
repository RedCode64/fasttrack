import { StyleSheet, Text, View } from "react-native";

import { fonts, statusLabel, statusPill, type PillTone } from "@/theme";

const FALLBACK: PillTone = { bg: "#eef0ec", fg: "#707b75" };

/** Status chip — colors keyed by (possibly derived) status value. */
export function Pill({ status }: { readonly status: string }) {
  const tone = statusPill[status] ?? FALLBACK;
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.fg }]}>{statusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 11,
    fontFamily: fonts.sans700,
  },
});
