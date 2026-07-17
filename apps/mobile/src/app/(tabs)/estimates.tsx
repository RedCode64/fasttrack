import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { useDb, useQuery } from "@/db/DbProvider";
import { listEstimates } from "@/db/repos/estimateRepo";
import { money, shortDate } from "@/lib/format";
import { colors, fonts, spacing } from "@/theme";

/** The pipeline: every estimate, newest first (design "Estimates" screen). */
export default function Estimates() {
  const { org } = useDb();
  const router = useRouter();
  const orgId = org?.id ?? "";
  const rows = useQuery((c) => (orgId ? listEstimates(c, orgId) : Promise.resolve([])), [orgId]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Estimates</Text>
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          onPress={() => router.push("/estimate/new")}
        >
          <Icon name="plus" size={18} color={colors.surface} strokeWidth={2.2} />
        </Pressable>
      </View>

      {rows.data && rows.data.length === 0 ? (
        <EmptyState
          icon="doc"
          title="No estimates yet"
          hint="Tap + to draft your first estimate — the job is created with it."
        />
      ) : null}

      <View style={styles.list}>
        {rows.data?.map((row) => (
          <Pressable
            key={row.estimate.id}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() =>
              router.push({ pathname: "/estimate/[id]", params: { id: row.estimate.id } })
            }
          >
            <View style={styles.cardTop}>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.client}>{row.clientName}</Text>
                <Text style={styles.jobTitle}>{row.jobTitle}</Text>
              </View>
              <Pill status={row.estimate.status} />
            </View>
            <View style={styles.cardBottom}>
              <Text style={styles.date}>
                {shortDate(row.estimate.issued_at ?? row.estimate.created_at)}
              </Text>
              <Text style={styles.amount}>{money(row.estimate.total_cents)}</Text>
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
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.85,
  },
  list: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: 12,
  },
  card: {
    marginTop: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.cardRadius,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  cardPressed: {
    backgroundColor: "#f2f7f2",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  cardTitleWrap: {
    flex: 1,
  },
  client: {
    fontSize: 15,
    fontFamily: fonts.sans700,
    letterSpacing: -0.15,
    color: colors.ink,
  },
  jobTitle: {
    fontSize: 12.5,
    fontFamily: fonts.sans500,
    color: colors.muted,
    marginTop: 3,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 13,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  date: {
    fontSize: 12,
    fontFamily: fonts.sans500,
    color: colors.faint,
  },
  amount: {
    fontSize: 17,
    fontFamily: fonts.mono700,
    color: colors.ink,
  },
});
