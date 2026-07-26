import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenGlow } from "@/components/ScreenGlow";
import { PrimaryButton } from "@/components/ui/Buttons";
import { Icon } from "@/components/ui/Icon";
import { FREE_CLIENT_CAP, FREE_DOCUMENT_CAP } from "@/lib/gating";
import { WEB_URL } from "@/lib/webUrl";
import { useEntitlement } from "@/subscriptions/SubscriptionProvider";
import { buildPlanViews, recommendedPlanIdentifier } from "@/subscriptions/plans";
import type { ProPackage } from "@/subscriptions/purchasesClient";
import { colors, fonts, spacing } from "@/theme";

const PRIVACY_URL = `${WEB_URL}/privacy`;
// Apple's standard auto-renewing-subscription EULA (accepted default Terms of Use).
const TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

const PRO_FEATURES: readonly string[] = [
  "Unlimited clients and documents",
  "Clean PDFs — no FastTrack footer",
  "Cloud sync across your devices",
];

export default function PaywallScreen() {
  const router = useRouter();
  const { packages, error: loadError, purchase, restore } = useEntitlement();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plans = useMemo(() => buildPlanViews(packages), [packages]);
  // Offerings arrive after first render, so the preselection is derived rather
  // than seeded into state — otherwise it would stick on the empty list.
  const activeId = selected ?? recommendedPlanIdentifier(plans);
  const activePkg: ProPackage | undefined =
    packages.find((p) => p.identifier === activeId) ?? packages[0];

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const buy = () => {
    if (!activePkg) {
      setError("Plans are still loading — try again in a moment.");
      return;
    }
    void run(() => purchase(activePkg));
  };

  return (
    <View style={styles.root}>
      <ScreenGlow />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable style={styles.close} onPress={() => router.back()} accessibilityLabel="Close">
          <Icon name="back" size={18} color={colors.slate} />
        </Pressable>
        <Text style={styles.kicker}>FASTTRACK PRO</Text>
      </View>

      <Text style={styles.title}>Run your whole business, uncapped.</Text>
      <Text style={styles.blurb}>
        The free plan covers {FREE_CLIENT_CAP} clients and {FREE_DOCUMENT_CAP} documents. Upgrade to
        Pro for unlimited work, clean PDFs, and cloud sync.
      </Text>

      <View style={styles.features}>
        {PRO_FEATURES.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Icon name="check" size={16} color={colors.green} strokeWidth={2.2} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {packages.length === 0 ? (
        <Text style={styles.blurb}>
          {loadError ? `Couldn't load plans: ${loadError}` : "Plans are loading…"}
        </Text>
      ) : (
        <View style={styles.plans}>
          {plans.map((plan) => {
            const active = (activePkg?.identifier ?? null) === plan.identifier;
            return (
              <Pressable
                key={plan.identifier}
                style={[styles.plan, active && styles.planActive]}
                onPress={() => setSelected(plan.identifier)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${plan.label}, ${plan.priceString} ${plan.cadence ?? ""}`}
              >
                <View style={styles.planRadio}>
                  {active ? <View style={styles.planRadioDot} /> : null}
                </View>
                <View style={styles.planText}>
                  <View style={styles.planTitleRow}>
                    <Text style={[styles.planName, active && styles.planNameActive]}>
                      {plan.label}
                    </Text>
                    {plan.badge ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{plan.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  {plan.perMonthNote ? (
                    <Text style={styles.planNote}>{plan.perMonthNote}</Text>
                  ) : null}
                </View>
                <View style={styles.planPriceCol}>
                  <Text style={[styles.planPrice, active && styles.planNameActive]}>
                    {plan.priceString}
                  </Text>
                  {plan.cadence ? <Text style={styles.planNote}>{plan.cadence}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label={busy ? "Working…" : "Start Pro"}
        onPress={buy}
        disabled={busy || packages.length === 0}
        style={styles.cta}
      />

      <Pressable onPress={() => run(restore)} disabled={busy}>
        <Text style={styles.restore}>Restore purchases</Text>
      </Pressable>

      <View style={styles.legal}>
        <Pressable onPress={() => void Linking.openURL(TERMS_URL)}>
          <Text style={styles.legalLink}>Terms of Use</Text>
        </Pressable>
        <Text style={styles.legalDot}>·</Text>
        <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)}>
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </Pressable>
      </View>
      <Text style={styles.finePrint}>
        Subscriptions renew automatically until cancelled. Manage or cancel anytime in your App Store
        account settings.
      </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.screenBg },
  content: { padding: spacing.screenX, paddingTop: 52, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 18 },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderCircle,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: { fontSize: 10.5, fontFamily: fonts.sans700, letterSpacing: 1.5, color: colors.accent },
  title: {
    fontSize: 24,
    fontFamily: fonts.sans800,
    letterSpacing: -0.5,
    color: colors.ink,
    marginTop: 4,
  },
  blurb: {
    fontSize: 13.5,
    fontFamily: fonts.sans500,
    color: colors.slate,
    lineHeight: 20,
    marginTop: 10,
  },
  features: { marginTop: 20, gap: 12 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontSize: 14, fontFamily: fonts.sans600, color: colors.ink },
  plans: { gap: 10, marginTop: 24 },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderButton,
    borderRadius: spacing.cardRadius,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  planActive: { borderColor: colors.accent, backgroundColor: colors.accentWash },
  planRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderCircle,
    alignItems: "center",
    justifyContent: "center",
  },
  planRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  planText: { flex: 1, gap: 3 },
  planTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planPriceCol: { alignItems: "flex-end", gap: 3 },
  planName: { fontSize: 14, fontFamily: fonts.sans700, color: colors.ink },
  planNameActive: { color: colors.accent },
  planNote: { fontSize: 11.5, fontFamily: fonts.sans500, color: colors.slate },
  planPrice: { fontSize: 17, fontFamily: fonts.mono700, color: colors.ink },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 9.5,
    fontFamily: fonts.sans700,
    letterSpacing: 0.4,
    color: colors.white,
  },
  cta: { marginTop: 24 },
  restore: {
    marginTop: 16,
    fontSize: 13,
    fontFamily: fonts.sans700,
    color: colors.accent,
    textAlign: "center",
  },
  error: { marginTop: 14, fontSize: 12.5, fontFamily: fonts.sans600, color: colors.red },
  legal: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 22,
  },
  legalLink: { fontSize: 12, fontFamily: fonts.sans600, color: colors.slate },
  legalDot: { color: colors.faint },
  finePrint: {
    marginTop: 10,
    fontSize: 10.5,
    fontFamily: fonts.sans500,
    color: colors.faint,
    textAlign: "center",
    lineHeight: 15,
  },
});
