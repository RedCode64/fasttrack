import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActivityRow } from "@/components/ActivityRow";
import { EmptyState } from "@/components/EmptyState";
import { ScreenGlow } from "@/components/ScreenGlow";
import { HealthCard } from "@/components/HealthCard";
import { StatCard } from "@/components/StatCard";
import { GhostButton, PrimaryButton } from "@/components/ui/Buttons";
import { Icon } from "@/components/ui/Icon";
import { useDb, useQuery } from "@/db/DbProvider";
import { activity, healthForOrg, monthKpis } from "@/db/repos/kpis";
import { deltaLabel, greeting, money, moneyK, monthLabel, pctFromBps } from "@/lib/format";
import { colors, fonts, spacing } from "@/theme";

export default function Home() {
  const { org, ctx } = useDb();
  const router = useRouter();
  const orgId = org?.id ?? "";

  const health = useQuery((c) => (orgId ? healthForOrg(c, orgId) : Promise.resolve(null)), [orgId]);
  const kpis = useQuery((c) => (orgId ? monthKpis(c, orgId) : Promise.resolve(null)), [orgId]);
  const feed = useQuery((c) => (orgId ? activity(c, orgId, 8) : Promise.resolve([])), [orgId]);

  if (!org) return null; // gate redirects to onboarding
  const nowIso = ctx.now();

  return (
    <View style={styles.root}>
      <ScreenGlow />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>
            {org.name.toUpperCase()} · {monthLabel(nowIso)}
          </Text>
          <Text style={styles.title}>{greeting(new Date().getHours())}</Text>
        </View>
        <Pressable
          style={styles.cloudButton}
          onPress={() => router.push("/sync")}
          accessibilityLabel="Cloud sync"
        >
          <Icon name="cloud" size={19} color={colors.slate} />
        </Pressable>
      </View>

      {health.data ? <HealthCard health={health.data.health} /> : null}

      {kpis.data ? (
        <View style={styles.grid}>
          <StatCard
            label="Revenue"
            value={money(kpis.data.revenueCents)}
            sub={deltaLabel(kpis.data.revenueDeltaPct)}
            subColor={
              kpis.data.revenueDeltaPct !== null && kpis.data.revenueDeltaPct < 0
                ? colors.red
                : colors.green
            }
            detail={[
              { label: "This month", value: money(kpis.data.revenueCents) },
              { label: "vs last month", value: deltaLabel(kpis.data.revenueDeltaPct) },
            ]}
          />
          <StatCard
            label="Net profit"
            value={money(kpis.data.netProfitCents)}
            sub={`${pctFromBps(kpis.data.marginBps)} margin`}
            subColor={kpis.data.netProfitCents >= 0 ? colors.green : colors.red}
            detail={[
              { label: "Revenue", value: money(kpis.data.revenueCents) },
              { label: "Spend", value: money(kpis.data.spendCents) },
              { label: "Margin", value: `${pctFromBps(kpis.data.marginBps)}` },
            ]}
          />
          <StatCard
            label="Spend"
            value={money(kpis.data.spendCents)}
            sub={deltaLabel(kpis.data.spendDeltaPct)}
            subColor={
              kpis.data.spendDeltaPct !== null && kpis.data.spendDeltaPct > 0
                ? colors.red
                : colors.green
            }
            detail={[
              { label: "This month", value: money(kpis.data.spendCents) },
              { label: "vs last month", value: deltaLabel(kpis.data.spendDeltaPct) },
            ]}
          />
          <StatCard
            label="Outstanding"
            value={money(kpis.data.outstandingCents)}
            sub={
              kpis.data.overdueCents > 0
                ? `${moneyK(kpis.data.overdueCents)} overdue`
                : "Nothing overdue"
            }
            subColor={kpis.data.overdueCents > 0 ? colors.red : colors.green}
            detail={[
              { label: "Total open", value: money(kpis.data.outstandingCents) },
              { label: "Overdue", value: money(kpis.data.overdueCents) },
            ]}
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton
          label="New estimate"
          icon="plus"
          onPress={() => router.push("/estimate/new")}
          style={styles.actionButton}
        />
        <GhostButton
          label="Log expense"
          icon="cam"
          onPress={() => router.push("/expense/new")}
          style={styles.actionButton}
        />
      </View>

      <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
      <View style={styles.activityCard}>
        {feed.data && feed.data.length > 0 ? (
          feed.data.map((item, index) => (
            <ActivityRow
              key={`${item.kind}-${item.id}`}
              item={item}
              nowIso={nowIso}
              isLast={index === (feed.data?.length ?? 0) - 1}
            />
          ))
        ) : (
          <EmptyState
            icon="doc"
            title="No activity yet"
            hint="Send your first estimate or log an expense and it shows up here."
          />
        )}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
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
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  headerText: {
    flexShrink: 1,
  },
  cloudButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderCircle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  kicker: {
    fontSize: 10.5,
    fontFamily: fonts.sans700,
    letterSpacing: 1,
    color: colors.faint,
  },
  title: {
    fontSize: 27,
    fontFamily: fonts.sans700,
    letterSpacing: -0.8,
    color: colors.ink,
    marginTop: 3,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 11,
    marginHorizontal: spacing.screenX,
    marginTop: 14,
  },
  actions: {
    flexDirection: "row",
    gap: 11,
    marginHorizontal: spacing.screenX,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: fonts.sans700,
    letterSpacing: 0.8,
    color: colors.faint,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  activityCard: {
    marginHorizontal: spacing.screenX,
    marginBottom: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.cardRadius,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
});
