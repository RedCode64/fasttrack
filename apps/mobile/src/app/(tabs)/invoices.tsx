import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { useDb, useQuery } from "@/db/DbProvider";
import { listInvoices, type DisplayStatus, type InvoiceFilter } from "@/db/repos/invoiceRepo";
import { docNumber, money, shortDate } from "@/lib/format";
import { colors, fonts, spacing } from "@/theme";

const FILTERS: readonly { value: InvoiceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
];

const STATUS_TILE: Record<string, { icon: IconName; bg: string; fg: string }> = {
  paid: { icon: "check", bg: colors.greenWash, fg: colors.green },
  overdue: { icon: "alert", bg: colors.redWash, fg: colors.red },
  partial: { icon: "wallet", bg: colors.amberWash, fg: colors.amber },
  sent: { icon: "doc", bg: colors.blueWash, fg: colors.blue },
  viewed: { icon: "doc", bg: colors.tealWash, fg: colors.teal },
  draft: { icon: "doc", bg: colors.grayWash, fg: colors.gray },
};

function tile(status: DisplayStatus) {
  return STATUS_TILE[status] ?? STATUS_TILE.draft;
}

/** Invoices list with derived-status filter chips (design screen 4). */
export default function Invoices() {
  const { org } = useDb();
  const router = useRouter();
  const orgId = org?.id ?? "";
  const [filter, setFilter] = useState<InvoiceFilter>("all");
  const rows = useQuery(
    (c) => (orgId ? listInvoices(c, orgId, filter) : Promise.resolve([])),
    [orgId, filter],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Invoices</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {FILTERS.map(({ value, label }) => {
          const active = filter === value;
          return (
            <Pressable
              key={value}
              onPress={() => setFilter(value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {rows.data && rows.data.length === 0 ? (
        <EmptyState
          icon="receipt"
          title={filter === "all" ? "No invoices yet" : "Nothing here"}
          hint={
            filter === "all"
              ? "Accept an estimate, then convert it — the invoice lands here."
              : "No invoices match this filter right now."
          }
        />
      ) : null}

      <View style={styles.list}>
        {rows.data?.map((row) => {
          const t = tile(row.displayStatus);
          return (
            <Pressable
              key={row.invoice.id}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() =>
                router.push({ pathname: "/invoice/[id]", params: { id: row.invoice.id } })
              }
            >
              <View style={[styles.tile, { backgroundColor: t.bg }]}>
                <Icon name={t.icon} size={18} color={t.fg} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.client}>{row.clientName}</Text>
                <Text style={styles.meta}>
                  {docNumber("INV", row.invoice.number)}
                  {row.invoice.due_at ? ` · due ${shortDate(row.invoice.due_at)}` : " · draft"}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.amount}>{money(row.invoice.total_cents)}</Text>
                <Pill status={row.displayStatus} />
              </View>
            </Pressable>
          );
        })}
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
  title: {
    fontSize: 27,
    fontFamily: fonts.sans700,
    letterSpacing: -0.8,
    color: colors.ink,
    paddingTop: spacing.screenTop,
    paddingHorizontal: spacing.screenX,
  },
  chips: {
    flexGrow: 0,
    paddingHorizontal: spacing.screenX,
    paddingTop: 12,
    paddingBottom: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderButton,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  chipText: {
    fontSize: 12.5,
    fontFamily: fonts.sans600,
    color: colors.slate,
  },
  chipTextActive: {
    color: colors.white,
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  cardPressed: {
    backgroundColor: colors.surface2,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
  },
  client: {
    fontSize: 14.5,
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
    gap: 4,
  },
  amount: {
    fontSize: 15,
    fontFamily: fonts.mono700,
    color: colors.ink,
  },
});
