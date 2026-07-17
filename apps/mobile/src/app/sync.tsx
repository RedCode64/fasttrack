import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PrimaryButton } from "@/components/ui/Buttons";
import { Icon } from "@/components/ui/Icon";
import { useDb } from "@/db/DbProvider";
import { pushAll, supabaseTarget, type PushSummaryEntry } from "@/sync/push";
import { getSupabase } from "@/sync/supabaseClient";
import { colors, fonts, spacing } from "@/theme";

type Phase = "idle" | "authing" | "pushing" | "done" | "error";

/** Auth link + one-tap full push (Plan 5 sync v1: rows only, no pull). */
export default function SyncScreen() {
  const { ctx, org } = useDb();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<readonly PushSummaryEntry[] | null>(null);

  const linkAndPush = async () => {
    if (!org) {
      setMessage("Finish onboarding first.");
      return;
    }
    setPhase("authing");
    setMessage(null);
    setSummary(null);
    try {
      const supabase = getSupabase();
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw new Error(error.message);
        setPhase("idle");
        setMessage("Check your email to confirm the account, then sign in here.");
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw new Error(error.message);
      const user = data.user;
      if (!user?.email) throw new Error("Sign-in returned no user");

      setPhase("pushing");
      const result = await pushAll(supabaseTarget(supabase), ctx, org, {
        id: user.id,
        email: user.email,
        name: org.name,
      });
      await supabase.auth.signOut();
      setSummary(result);
      setPhase("done");
    } catch (e: unknown) {
      setPhase("error");
      setMessage(e instanceof Error ? e.message : "Sync failed");
    }
  };

  const isBusy = phase === "authing" || phase === "pushing";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Back">
          <Icon name="back" size={18} color={colors.slate} />
        </Pressable>
        <View>
          <Text style={styles.kicker}>CLOUD SYNC</Text>
          <Text style={styles.title}>Push your books online</Text>
        </View>
      </View>

      <Text style={styles.blurb}>
        Everything stays on this phone. Signing in copies your estimates, invoices, payments, and
        expenses to your FastTrack cloud account so the web dashboard can read them.
      </Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@company.com"
        placeholderTextColor={colors.faint}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        style={styles.input}
        accessibilityLabel="Email"
      />
      <Text style={styles.label}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={colors.faint}
        secureTextEntry
        style={styles.input}
        accessibilityLabel="Password"
      />

      <PrimaryButton
        label={
          isBusy
            ? phase === "pushing"
              ? "Pushing your books…"
              : "Signing in…"
            : mode === "signin"
              ? "Sign in & push"
              : "Create account"
        }
        icon="cloud"
        onPress={linkAndPush}
        disabled={isBusy || email.trim().length === 0 || password.length === 0}
        style={styles.submit}
      />
      <Pressable
        onPress={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setMessage(null);
        }}
        disabled={isBusy}
      >
        <Text style={styles.switchMode}>
          {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
        </Text>
      </Pressable>

      {isBusy ? <ActivityIndicator color={colors.green} style={styles.spinner} /> : null}
      {message ? (
        <Text style={[styles.message, phase === "error" && styles.messageError]}>{message}</Text>
      ) : null}
      {summary ? (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHead}>
            <Icon name="check" size={16} color={colors.green} />
            <Text style={styles.summaryTitle}>Pushed to cloud</Text>
          </View>
          {summary.map((s) => (
            <Text key={s.table} style={styles.summaryRow}>
              {s.table.replaceAll("_", " ")} · {s.count}
            </Text>
          ))}
        </View>
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
    paddingTop: 52,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  blurb: {
    fontSize: 13,
    fontFamily: fonts.sans500,
    color: colors.slate,
    lineHeight: 19,
  },
  label: {
    fontSize: 12,
    fontFamily: fonts.sans600,
    color: colors.slate,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderButton,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: fonts.sans600,
    color: colors.ink,
  },
  submit: {
    marginTop: 20,
  },
  switchMode: {
    marginTop: 14,
    fontSize: 13,
    fontFamily: fonts.sans700,
    color: colors.green,
    textAlign: "center",
  },
  spinner: {
    marginTop: 16,
  },
  message: {
    marginTop: 14,
    fontSize: 13,
    fontFamily: fonts.sans500,
    color: colors.slate,
  },
  messageError: {
    color: colors.red,
  },
  summaryCard: {
    marginTop: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.cardRadius,
    padding: 14,
    gap: 4,
  },
  summaryHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 14,
    fontFamily: fonts.sans700,
    color: colors.ink,
  },
  summaryRow: {
    fontSize: 12.5,
    fontFamily: fonts.sans500,
    color: colors.slate,
  },
});
