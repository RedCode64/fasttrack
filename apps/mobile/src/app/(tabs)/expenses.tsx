import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useDb, useQuery } from "@/db/DbProvider";
import { listExpenses, monthSummary } from "@/db/repos/expenseRepo";
import { money, monthLabel, shortDate } from "@/lib/format";
import { resolveReceiptUri } from "@/lib/receipt";
import { colors, fonts, spacing } from "@/theme";

function monthName(nowIso: string): string {
  const label = monthLabel(nowIso); // "JULY 2026"
  const word = label.slice(0, label.indexOf(" "));
  return word.charAt(0) + word.slice(1).toLowerCase();
}

/** Expenses list + month/week spend summary (design screen 6). */
export default function Expenses() {
  const { org, ctx } = useDb();
  const router = useRouter();
  const orgId = org?.id ?? "";
  const rows = useQuery((c) => (orgId ? listExpenses(c, orgId) : Promise.resolve([])), [orgId]);
  const summary = useQuery(
    (c) => (orgId ? monthSummary(c, orgId) : Promise.resolve(null)),
    [orgId],
  );
  const nowIso = ctx.now();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Expenses</Text>
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          onPress={() => router.push("/expense/new")}
        >
          <Icon name="plus" size={18} color={colors.white} strokeWidth={2.2} />
        </Pressable>
      </View>

      {summary.data ? (
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>{monthName(nowIso)} spend</Text>
            <Text style={styles.summaryValue}>{money(summary.data.monthCents)}</Text>
          </View>
          <View style={styles.summaryRight}>
            <Text style={styles.summaryLabel}>This week</Text>
            <Text style={styles.summaryWeek}>{money(summary.data.weekCents)}</Text>
          </View>
        </View>
      ) : null}

      {rows.data && rows.data.length === 0 ? (
        <EmptyState
          icon="wallet"
          title="No expenses yet"
          hint="Tap + to snap a receipt and log the spend."
        />
      ) : null}

      <View style={styles.list}>
        {rows.data?.map(({ expense, categoryName, jobTitle }) => (
          <Pressable
            key={expense.id}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() =>
              router.push({ pathname: "/expense/[id]", params: { id: expense.id } })
            }
          >
            {expense.receipt_storage_path ? (
              <Image
                source={{ uri: resolveReceiptUri(expense.receipt_storage_path) }}
                style={styles.thumb}
                contentFit="cover"
              />
            ) : (
              <View style={styles.thumbEmpty}>
                <Icon name="receipt" size={16} color={colors.faint} />
              </View>
            )}
            <View style={styles.cardBody}>
              <Text style={styles.vendor} numberOfLines={1}>
                {expense.vendor ?? categoryName}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {categoryName} · {jobTitle ?? "Overhead"}
              </Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.amount}>{money(expense.amount_cents, { showCents: true })}</Text>
              <Text style={styles.date}>{shortDate(expense.spent_at)}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  content: {
    paddingBottom: 24,
  },
  header: {
    paddingTop: spacing.screenTop,
    paddingHorizontal: spacing.screenX,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 27,
    fontFamily: fonts.sans700,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.85,
  },
  summaryCard: {
    marginHorizontal: spacing.screenX,
    marginTop: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.cardRadius,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  summaryLabel: {
    fontSize: 11.5,
    fontFamily: fonts.sans600,
    color: colors.muted,
  },
  summaryValue: {
    fontSize: 24,
    fontFamily: fonts.mono700,
    color: colors.ink,
    marginTop: 3,
  },
  summaryRight: {
    alignItems: "flex-end",
  },
  summaryWeek: {
    fontSize: 16,
    fontFamily: fonts.mono600,
    color: colors.ink,
    marginTop: 3,
  },
  list: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: 12,
  },
  card: {
    marginTop: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.cardRadius,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardPressed: {
    backgroundColor: colors.surface2,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  thumbEmpty: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.grayWash,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
  },
  vendor: {
    fontSize: 14,
    fontFamily: fonts.sans700,
    color: colors.ink,
  },
  meta: {
    fontSize: 12,
    fontFamily: fonts.sans500,
    color: colors.muted,
    marginTop: 2,
  },
  cardRight: {
    alignItems: "flex-end",
  },
  amount: {
    fontSize: 14.5,
    fontFamily: fonts.mono700,
    color: colors.ink,
  },
  date: {
    fontSize: 11.5,
    fontFamily: fonts.sans500,
    color: colors.faint,
    marginTop: 2,
  },
});
