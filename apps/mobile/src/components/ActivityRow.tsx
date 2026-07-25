import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ActivityItem } from "@/db/repos/kpis";
import { money, relativeTime } from "@/lib/format";
import { colors, fonts } from "@/theme";

const KIND_LABEL: Record<ActivityItem["kind"], string> = {
  payment_received: "Payment received",
  invoice_sent: "Invoice sent",
  expense_logged: "Expense logged",
  invoice_overdue: "Invoice overdue",
};

const KIND_DOT: Record<ActivityItem["kind"], string> = {
  payment_received: colors.green,
  invoice_sent: colors.blue,
  expense_logged: colors.muted,
  invoice_overdue: colors.red,
};

export function ActivityRow({
  item,
  nowIso,
  isLast,
}: {
  readonly item: ActivityItem;
  readonly nowIso: string;
  readonly isLast: boolean;
}) {
  const router = useRouter();
  const open = () => {
    if (item.kind === "expense_logged") {
      router.push({ pathname: "/expense/[id]", params: { id: item.targetId } });
    } else {
      router.push({ pathname: "/invoice/[id]", params: { id: item.targetId } });
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.row, !isLast && styles.divider, pressed && styles.pressed]}
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${KIND_LABEL[item.kind]}, ${money(item.amountCents)}, ${item.counterparty}. Opens the document.`}
    >
      <View style={[styles.dot, { backgroundColor: KIND_DOT[item.kind] }]} />
      <View style={styles.body}>
        <Text style={styles.kind}>{KIND_LABEL[item.kind]}</Text>
        <Text style={styles.detail}>
          {money(item.amountCents)} · {item.counterparty}
        </Text>
      </View>
      <Text style={styles.time}>{relativeTime(item.at, nowIso)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  // Dimming rather than a fill: the row sits inside the activity card's own
  // padding, so a background would read as an inset block against the divider.
  pressed: {
    opacity: 0.55,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  body: {
    flex: 1,
  },
  kind: {
    fontSize: 13.5,
    fontFamily: fonts.sans600,
    color: colors.ink,
  },
  detail: {
    fontSize: 12,
    fontFamily: fonts.sans500,
    color: colors.muted,
    marginTop: 1,
  },
  time: {
    fontSize: 11,
    fontFamily: fonts.sans500,
    color: colors.dim,
  },
});
