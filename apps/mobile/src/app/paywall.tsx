import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenGlow } from "@/components/ScreenGlow";
import { PrimaryButton } from "@/components/ui/Buttons";
import { Icon } from "@/components/ui/Icon";
import { FREE_CLIENT_CAP, FREE_DOCUMENT_CAP } from "@/lib/gating";
import { useEntitlement } from "@/subscriptions/SubscriptionProvider";
import type { ProPackage } from "@/subscriptions/purchasesClient";
import { colors, fonts, spacing } from "@/theme";

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "https://fasttrack.app";
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
  const { packages, purchase, restore } = useEntitlement();
  const [selected, setSelected] = useState<string | null>(packages[0]?.identifier ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePkg: ProPackage | undefined =
    packages.find((p) => p.identifier === selected) ?? packages[0];

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
        <Text style={styles.blurb}>Plans are loading…</Text>
      ) : (
        <View style={styles.plans}>
          {packages.map((pkg) => {
            const active = (activePkg?.identifier ?? null) === pkg.identifier;
            return (
              <Pressable
                key={pkg.identifier}
                style={[styles.plan, active && styles.planActive]}
                onPress={() => setSelected(pkg.identifier)}
              >
                <Text style={[styles.planName, active && styles.planNameActive]}>
                  {pkg.product.title}
                </Text>
                <Text style={[styles.planPrice, active && styles.planNameActive]}>
                  {pkg.product.priceString}
                </Text>
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
  plans: { flexDirection: "row", gap: 10, marginTop: 24 },
  plan: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderButton,
    borderRadius: spacing.cardRadius,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  planActive: { borderColor: colors.accent, backgroundColor: colors.accentWash },
  planName: { fontSize: 13, fontFamily: fonts.sans700, color: colors.slate },
  planNameActive: { color: colors.accent },
  planPrice: { fontSize: 17, fontFamily: fonts.mono700, color: colors.ink },
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
