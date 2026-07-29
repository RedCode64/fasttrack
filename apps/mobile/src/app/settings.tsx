import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenGlow } from "@/components/ScreenGlow";
import { GhostButton, PrimaryButton } from "@/components/ui/Buttons";
import { HomeButton } from "@/components/ui/HomeButton";
import { Icon } from "@/components/ui/Icon";
import { useDb } from "@/db/DbProvider";
import { ledgerForExport } from "@/db/repos/kpis";
import { resetAllData } from "@/db/reset";
import { buildLedgerCsv } from "@/lib/csvExport";
import {
  PRESET_LABELS,
  PRESET_ORDER,
  rangeFilenameSlug,
  rangeFor,
  rangeLabel,
  type RangePreset,
} from "@/lib/dateRange";
import { shareCsv } from "@/lib/exportFile";
import { clearSettings, loadSettings, saveSettings } from "@/lib/settings";
import { colors, fonts, spacing } from "@/theme";

/** Business hub: the "get paid" link and the accountant export. */
export default function SettingsScreen() {
  const { org, ctx, mutate, refreshOrg } = useDb();
  const router = useRouter();

  const [payLink, setPayLink] = useState(() => loadSettings().payLink ?? "");
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [preset, setPreset] = useState<RangePreset>("this_month");
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (!org) return null;

  // Recomputed each render rather than memoised, so a session left open across
  // midnight or a month boundary still exports the range the label promises.
  const range = rangeFor(preset);

  const savePayLink = () => {
    const trimmed = payLink.trim();
    saveSettings({ payLink: trimmed || null });
    setPayLink(trimmed);
    setSavedNote(trimmed ? "Saved — it'll appear on payment requests." : "Cleared.");
  };

  const exportLedger = async () => {
    setExporting(true);
    setError(null);
    setExportNote(null);
    try {
      const ledger = await ledgerForExport(ctx, org.id, range);
      if (ledger.payments.length === 0 && ledger.expenses.length === 0) {
        setExportNote(
          range.preset === "all"
            ? "Nothing to export yet — record a payment or log an expense first."
            : `Nothing in ${rangeLabel(range)}. Try a wider range.`,
        );
        return;
      }
      const csv = buildLedgerCsv(ledger);
      // The range goes in the filename so two exports never look interchangeable.
      await shareCsv(`fasttrack-ledger-${rangeFilenameSlug(range)}.csv`, csv);
      setExportNote(
        `${rangeLabel(range)}: ${ledger.payments.length} payment${ledger.payments.length === 1 ? "" : "s"} and ${ledger.expenses.length} expense${ledger.expenses.length === 1 ? "" : "s"}.`,
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not export the ledger");
    } finally {
      setExporting(false);
    }
  };

  const resetEverything = async () => {
    setResetting(true);
    setError(null);
    try {
      await mutate((c) => resetAllData(c));
      clearSettings();
      await refreshOrg();
      router.replace("/onboarding");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not reset your data");
      setResetting(false);
      setConfirmingReset(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenGlow />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={() => router.back()}>
            <Icon name="back" size={18} color={colors.slate} />
          </Pressable>
          <HomeButton />
          <View>
            <Text style={styles.kicker}>BUSINESS</Text>
            <Text style={styles.title}>Get paid &amp; export</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>PAYMENT LINK</Text>
        <View style={styles.card}>
          <Text style={styles.cardHint}>
            Your Venmo, Zelle, PayPal.me, or Stripe link. We add it to every payment
            request so clients can pay online in one tap.
          </Text>
          <TextInput
            style={styles.input}
            value={payLink}
            onChangeText={(t) => {
              setPayLink(t);
              setSavedNote(null);
            }}
            placeholder="https://venmo.com/your-handle"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <PrimaryButton label="Save link" onPress={savePayLink} style={styles.save} />
          {savedNote ? <Text style={styles.note}>{savedNote}</Text> : null}
        </View>

        <Text style={styles.sectionLabel}>ACCOUNTANT EXPORT</Text>
        <View style={styles.card}>
          <Text style={styles.cardHint}>
            A cash ledger — payments in, expenses out — as a CSV your bookkeeper can
            import into QuickBooks, Xero, or a spreadsheet.
          </Text>

          <View style={styles.segment}>
            {PRESET_ORDER.map((value) => (
              <Pressable
                key={value}
                style={[styles.segmentItem, preset === value && styles.segmentActive]}
                onPress={() => {
                  setPreset(value);
                  setExportNote(null);
                }}
              >
                <Text
                  style={[styles.segmentText, preset === value && styles.segmentTextActive]}
                >
                  {PRESET_LABELS[value]}
                </Text>
              </Pressable>
            ))}
          </View>

          <GhostButton
            label={exporting ? "Preparing…" : `Export ${rangeLabel(range)} (CSV)`}
            icon="share"
            onPress={exportLedger}
            disabled={exporting}
            style={styles.save}
          />
          {exportNote ? <Text style={styles.note}>{exportNote}</Text> : null}
        </View>

        <Text style={styles.sectionLabel}>RESET</Text>
        <View style={styles.card}>
          <Text style={styles.cardHint}>
            Deletes every client, job, estimate, invoice, payment, and expense stored
            on this phone, and returns you to setup. This cannot be undone.
          </Text>
          {confirmingReset ? (
            <>
              <Text style={styles.danger}>
                Permanently delete everything? Export your ledger first if you need a
                record.
              </Text>
              <View style={styles.confirmRow}>
                <GhostButton
                  label="Cancel"
                  onPress={() => setConfirmingReset(false)}
                  disabled={resetting}
                  style={styles.confirmButton}
                />
                <GhostButton
                  label={resetting ? "Deleting…" : "Delete everything"}
                  onPress={() => void resetEverything()}
                  disabled={resetting}
                  style={[styles.confirmButton, styles.destructive]}
                />
              </View>
            </>
          ) : (
            <GhostButton
              label="Reset all app data"
              onPress={() => setConfirmingReset(true)}
              style={styles.save}
            />
          )}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.screenBg },
  content: { padding: spacing.screenX, paddingTop: 52, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 8 },
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
  kicker: { fontSize: 10.5, fontFamily: fonts.sans700, letterSpacing: 1, color: colors.faint },
  title: { fontSize: 17, fontFamily: fonts.sans700, letterSpacing: -0.3, color: colors.ink, marginTop: 1 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: fonts.sans700,
    letterSpacing: 0.8,
    color: colors.faint,
    paddingTop: 22,
    paddingBottom: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.cardRadius,
    padding: 16,
  },
  cardHint: {
    fontSize: 12.5,
    fontFamily: fonts.sans500,
    color: colors.slate,
    lineHeight: 18,
    marginBottom: 12,
  },
  danger: {
    fontSize: 12.5,
    fontFamily: fonts.sans600,
    color: colors.red,
    lineHeight: 18,
    marginBottom: 12,
  },
  confirmRow: {
    flexDirection: "row",
    gap: 10,
  },
  confirmButton: {
    flex: 1,
  },
  destructive: {
    borderColor: colors.red,
    backgroundColor: colors.redWash,
  },
  input: {
    backgroundColor: colors.screenBg,
    borderWidth: 1,
    borderColor: colors.borderButton,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: fonts.sans600,
    color: colors.ink,
  },
  save: { marginTop: 12 },
  segment: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  segmentItem: {
    flexGrow: 1,
    flexBasis: "45%",
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderButton,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  segmentText: {
    fontSize: 12.5,
    fontFamily: fonts.sans600,
    color: colors.slate,
  },
  segmentTextActive: {
    color: colors.white,
  },
  note: { fontSize: 12, fontFamily: fonts.sans600, color: colors.green, marginTop: 10 },
  error: { fontSize: 12.5, fontFamily: fonts.sans600, color: colors.red, marginTop: 10 },
});
