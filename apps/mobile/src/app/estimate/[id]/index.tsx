import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { GhostButton, PrimaryButton } from "@/components/ui/Buttons";
import { Icon } from "@/components/ui/Icon";
import { useDb, useQuery } from "@/db/DbProvider";
import {
  estimateProfit,
  getEstimate,
  markAccepted,
  markDeclined,
  sendEstimate,
} from "@/db/repos/estimateRepo";
import { convertFromEstimate, invoiceForEstimate } from "@/db/repos/invoiceRepo";
import { estimatePdfInput } from "@/lib/docPdf";
import { money, pctFromBps } from "@/lib/format";
import { buildDocumentHtml } from "@/lib/pdf";
import { sharePdf } from "@/lib/printPdf";
import { colors, fonts, spacing } from "@/theme";

/** The builder/detail: live documentProfit hero + line cards (design screen 3). */
export default function EstimateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { org, mutate } = useDb();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const detail = useQuery((c) => getEstimate(c, id), [id]);
  const convertedId = useQuery((c) => invoiceForEstimate(c, id), [id]);

  if (!org || !detail.data) {
    return <View style={styles.screen}>{detail.error ? <Text style={styles.error}>{detail.error}</Text> : null}</View>;
  }
  const data = detail.data;
  const profit = estimateProfit(data);
  const status = data.estimate.status;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const preview = () =>
    run(async () => {
      await sharePdf(buildDocumentHtml(estimatePdfInput(org, data)));
    });
  const send = () =>
    run(async () => {
      await sharePdf(buildDocumentHtml(estimatePdfInput(org, data)));
      await mutate((c) => sendEstimate(c, id));
    });
  const accept = () => run(() => mutate((c) => markAccepted(c, id)));
  const decline = () => run(() => mutate((c) => markDeclined(c, id)));
  const convert = () =>
    run(async () => {
      const invoice = await mutate((c) => convertFromEstimate(c, id));
      router.push({ pathname: "/invoice/[id]", params: { id: invoice.id } });
    });
  const viewInvoice = () => {
    if (convertedId.data) {
      router.push({ pathname: "/invoice/[id]", params: { id: convertedId.data } });
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Icon name="back" size={18} color={colors.slate} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>ESTIMATE · {status.toUpperCase()}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {data.client.name} — {data.job.title}
          </Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <RadialGradient id="estGrad" cx="15%" cy="10%" rx="140%" ry="130%">
              <Stop offset="0" stopColor={colors.greenDeep} />
              <Stop offset="1" stopColor={colors.greenDark} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" rx={spacing.heroRadius} fill="url(#estGrad)" />
        </Svg>
        <Text style={styles.heroLabel}>Estimate total</Text>
        <Text style={styles.heroTotal}>{money(data.estimate.total_cents)}</Text>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heroSubLabel}>Your cost</Text>
            <Text style={styles.heroSubValue}>{money(profit.costCents)}</Text>
          </View>
          <View>
            <Text style={styles.heroSubLabel}>Profit</Text>
            <Text style={styles.heroSubValue}>{money(profit.profitCents)}</Text>
          </View>
          <View style={styles.heroMargin}>
            <Text style={styles.heroSubLabel}>Margin</Text>
            <Text style={[styles.heroSubValue, styles.heroMarginValue]}>
              {pctFromBps(profit.marginBps)}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionLabel}>LINE ITEMS · COST + MARKUP</Text>
      {data.lines.map((line) => (
        <Pressable
          key={line.id}
          style={({ pressed }) => [styles.lineCard, pressed && styles.linePressed]}
          onPress={() =>
            router.push({ pathname: "/estimate/[id]/line", params: { id, lineId: line.id } })
          }
        >
          <View style={styles.lineTop}>
            <Text style={styles.lineName} numberOfLines={1}>
              {line.description}
            </Text>
            <Text style={styles.linePrice}>{money(line.unit_price_cents)}</Text>
          </View>
          <View style={styles.lineBottom}>
            <Text style={styles.lineMeta}>
              {line.quantity} {line.unit} · {money(line.unit_cost_cents)} ea
            </Text>
            <View style={styles.markupChip}>
              <Text style={styles.markupText}>markup +{pctFromBps(line.markup_pct)}</Text>
            </View>
          </View>
        </Pressable>
      ))}

      {status === "draft" ? (
        <Pressable
          style={({ pressed }) => [styles.addLine, pressed && styles.linePressed]}
          onPress={() => router.push({ pathname: "/estimate/[id]/line", params: { id } })}
        >
          <Text style={styles.addLineText}>+ Add line item</Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {status === "draft" ? (
          <>
            <GhostButton label="Preview" icon="pdf" onPress={preview} disabled={busy} style={styles.actionGhost} />
            <PrimaryButton
              label="Send estimate"
              onPress={send}
              disabled={busy || data.lines.length === 0}
              style={styles.actionPrimary}
            />
          </>
        ) : null}
        {status === "sent" || status === "viewed" ? (
          <>
            <GhostButton label="Declined" onPress={decline} disabled={busy} style={styles.actionGhost} />
            <PrimaryButton label="Mark accepted" icon="check" onPress={accept} disabled={busy} style={styles.actionPrimary} />
          </>
        ) : null}
        {status === "accepted" ? (
          <>
            <GhostButton label="Preview" icon="pdf" onPress={preview} disabled={busy} style={styles.actionGhost} />
            {convertedId.data ? (
              <PrimaryButton label="View invoice" icon="receipt" onPress={viewInvoice} disabled={busy} style={styles.actionPrimary} />
            ) : (
              <PrimaryButton label="Convert to invoice" icon="receipt" onPress={convert} disabled={busy} style={styles.actionPrimary} />
            )}
          </>
        ) : null}
        {status === "declined" || status === "expired" ? (
          <GhostButton label="Preview" icon="pdf" onPress={preview} disabled={busy} style={styles.actionGhost} />
        ) : null}
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
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 52,
    paddingHorizontal: spacing.screenX,
    paddingBottom: 16,
  },
  back: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderCircle,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  kicker: {
    fontSize: 10.5,
    fontFamily: fonts.sans700,
    letterSpacing: 1,
    color: colors.faint,
  },
  title: {
    fontSize: 17,
    fontFamily: fonts.sans700,
    letterSpacing: -0.3,
    color: colors.ink,
    marginTop: 1,
  },
  hero: {
    marginHorizontal: spacing.screenX,
    borderRadius: spacing.heroRadius,
    padding: 18,
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  heroLabel: {
    fontSize: 12,
    fontFamily: fonts.sans600,
    color: "rgba(255,255,255,0.7)",
  },
  heroTotal: {
    fontSize: 32,
    fontFamily: fonts.mono700,
    color: colors.surface,
    marginTop: 2,
  },
  heroRow: {
    flexDirection: "row",
    gap: 22,
    marginTop: 14,
  },
  heroSubLabel: {
    fontSize: 11,
    fontFamily: fonts.sans500,
    color: "rgba(255,255,255,0.65)",
  },
  heroSubValue: {
    fontSize: 15,
    fontFamily: fonts.mono600,
    color: colors.surface,
    marginTop: 2,
  },
  heroMargin: {
    marginLeft: "auto",
    alignItems: "flex-end",
  },
  heroMarginValue: {
    fontFamily: fonts.mono700,
    color: colors.mint,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: fonts.sans700,
    letterSpacing: 0.8,
    color: colors.faint,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  lineCard: {
    marginHorizontal: spacing.screenX,
    marginBottom: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.cardRadiusSm,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  linePressed: {
    backgroundColor: "#f2f7f2",
  },
  lineTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 10,
  },
  lineName: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.sans600,
    color: colors.ink,
  },
  linePrice: {
    fontSize: 15,
    fontFamily: fonts.mono700,
    color: colors.ink,
  },
  lineBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 9,
  },
  lineMeta: {
    fontSize: 12,
    fontFamily: fonts.sans500,
    color: colors.muted,
  },
  markupChip: {
    marginLeft: "auto",
    backgroundColor: colors.greenWash,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  markupText: {
    fontSize: 11.5,
    fontFamily: fonts.sans700,
    color: colors.green,
  },
  addLine: {
    marginHorizontal: spacing.screenX,
    marginTop: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#cdd4cb",
    borderRadius: 14,
    padding: 13,
    alignItems: "center",
  },
  addLineText: {
    fontSize: 13.5,
    fontFamily: fonts.sans600,
    color: colors.green,
  },
  error: {
    marginHorizontal: spacing.screenX,
    marginTop: 12,
    fontSize: 12.5,
    fontFamily: fonts.sans600,
    color: colors.red,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: spacing.screenX,
    marginTop: 18,
  },
  actionGhost: {
    flex: 1,
  },
  actionPrimary: {
    flex: 1.4,
  },
});
