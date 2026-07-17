import { tradeSchema, type Trade } from "@fasttrack/schema";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { GhostButton, PrimaryButton } from "@/components/ui/Buttons";
import { useDb } from "@/db/DbProvider";
import { createOrg } from "@/db/repos/orgRepo";
import { seedDemo } from "@/db/seeds/demo";
import { colors, fonts, spacing } from "@/theme";

const TRADE_LABELS: Record<Trade, string> = {
  electrical: "Electrical",
  plumbing: "Plumbing",
  hvac: "HVAC",
  general_contracting: "General contracting",
  handyman: "Handyman",
  other: "Other",
};

/** "30" (percent text) → 3000 bps, or null when unparseable. */
function pctToBps(text: string): number | null {
  const value = Number.parseFloat(text);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export default function Onboarding() {
  const { mutate, refreshOrg } = useDb();
  const router = useRouter();
  const [name, setName] = useState("");
  const [trade, setTrade] = useState<Trade | null>(null);
  const [marginPct, setMarginPct] = useState("30");
  const [taxPct, setTaxPct] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const targetMarginBps = pctToBps(marginPct);
    const taxRateBps = pctToBps(taxPct);
    if (!trade) {
      setError("Pick your trade — it seeds your price book.");
      return;
    }
    if (targetMarginBps === null || targetMarginBps < 1 || targetMarginBps > 9999) {
      setError("Target margin must be between 0.01% and 99.99%.");
      return;
    }
    if (taxRateBps === null || taxRateBps < 0) {
      setError("Tax rate can't be negative.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await mutate((ctx) =>
        createOrg(ctx, { name: name.trim(), trade, targetMarginBps, taxRateBps }),
      );
      await refreshOrg();
      router.replace("/(tabs)");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not create your business");
    } finally {
      setBusy(false);
    }
  };

  const loadDemo = async () => {
    setBusy(true);
    setError(null);
    try {
      await mutate((ctx) => seedDemo(ctx));
      await refreshOrg();
      router.replace("/(tabs)");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Demo data failed to load");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>WELCOME TO FASTTRACK</Text>
      <Text style={styles.title}>Set up your business</Text>
      <Text style={styles.sub}>
        Everything lives on this device — no account needed to start quoting.
      </Text>

      <Text style={styles.label}>Business name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Reyes Electric"
        placeholderTextColor={colors.faint}
      />

      <Text style={styles.label}>Trade</Text>
      <View style={styles.chips}>
        {tradeSchema.options.map((option) => {
          const active = trade === option;
          return (
            <Pressable
              key={option}
              onPress={() => setTrade(option)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {TRADE_LABELS[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.rateRow}>
        <View style={styles.rateField}>
          <Text style={styles.label}>Target margin %</Text>
          <TextInput
            style={styles.input}
            value={marginPct}
            onChangeText={setMarginPct}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.rateField}>
          <Text style={styles.label}>Tax rate %</Text>
          <TextInput
            style={styles.input}
            value={taxPct}
            onChangeText={setTaxPct}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label={busy ? "Setting up…" : "Create my price book"}
        onPress={submit}
        disabled={busy || name.trim().length === 0 || !trade}
        style={styles.submit}
      />

      {__DEV__ ? (
        <GhostButton
          label="Load demo data (Reyes Electric)"
          onPress={loadDemo}
          disabled={busy}
          style={styles.demo}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  content: {
    padding: spacing.screenX,
    paddingTop: 84,
    paddingBottom: 48,
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
  sub: {
    fontSize: 13,
    fontFamily: fonts.sans500,
    color: colors.muted,
    marginTop: 6,
    lineHeight: 19,
  },
  label: {
    fontSize: 12,
    fontFamily: fonts.sans600,
    color: colors.slate,
    marginTop: 20,
    marginBottom: 7,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderButton,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: fonts.sans600,
    color: colors.ink,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderButton,
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
    color: colors.surface,
  },
  rateRow: {
    flexDirection: "row",
    gap: 11,
  },
  rateField: {
    flex: 1,
  },
  error: {
    marginTop: 16,
    fontSize: 12.5,
    fontFamily: fonts.sans600,
    color: colors.red,
  },
  submit: {
    marginTop: 24,
  },
  demo: {
    marginTop: 10,
  },
});
