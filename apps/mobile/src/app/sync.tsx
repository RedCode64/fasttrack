import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenGlow } from "@/components/ScreenGlow";
import { PrimaryButton } from "@/components/ui/Buttons";
import { HomeButton } from "@/components/ui/HomeButton";
import { Icon } from "@/components/ui/Icon";
import { useDb } from "@/db/DbProvider";
import { authErrorMessage, syncErrorMessage } from "@/lib/authErrors";
import { canSync } from "@/lib/gating";
import { WEB_URL } from "@/lib/webUrl";
import { useEntitlement } from "@/subscriptions/SubscriptionProvider";
import { pushAll, supabaseTarget, type PushSummaryEntry } from "@/sync/push";
import { getAuthedSupabase, getSupabase } from "@/sync/supabaseClient";
import { colors, fonts, spacing } from "@/theme";

type Phase = "idle" | "authing" | "pushing" | "done" | "error";

/** Auth link + one-tap full push (Plan 5 sync v1: rows only, no pull). */
export default function SyncScreen() {
  const { ctx, org } = useDb();
  const router = useRouter();
  const { isPro } = useEntitlement();
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
        if (error) return failAuth(error);
        setPhase("idle");
        setMessage("Check your email to confirm the account, then sign in here.");
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) return failAuth(error);
      const user = data.user;
      const session = data.session;
      if (!user?.email || !session?.access_token) {
        setPhase("error");
        setMessage("Confirm your email address first, then sign in again.");
        return;
      }

      // Pushing is the Pro feature; having an account is not. Gating sign-in
      // itself stranded anyone who deleted their account behind the paywall
      // with no way back — and Apple requires deletion to be reversible by
      // simply signing up again.
      if (!canSync(isPro)) {
        await supabase.auth.signOut({ scope: "local" });
        setPhase("idle");
        router.push("/paywall");
        return;
      }

      setPhase("pushing");
      // Push through a client that carries the user's token on every request,
      // so RLS sees `authenticated` (not `anon`) on the very first insert.
      const authed = getAuthedSupabase(session.access_token);
      const result = await pushAll(supabaseTarget(authed), ctx, org, {
        id: user.id,
        email: user.email,
        name: org.name,
      });
      await supabase.auth.signOut();
      setSummary(result);
      setPhase("done");
    } catch (e: unknown) {
      setPhase("error");
      setMessage(syncErrorMessage(e));
    }
  };

  const failAuth = (error: unknown) => {
    setPhase("error");
    setMessage(authErrorMessage(error));
  };

  /**
   * Recovery finishes on the web dashboard rather than in the app: the emailed
   * link lands on /auth/callback, which needs no iOS deep-link registration and
   * no extra App Store review surface. The owner then signs in here as usual.
   */
  const sendReset = async () => {
    const address = email.trim();
    if (!address) {
      setPhase("error");
      setMessage("Enter your email address first.");
      return;
    }
    setPhase("authing");
    setMessage(null);
    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(address, {
        redirectTo: `${WEB_URL}/auth/callback?next=/reset-password`,
      });
      // Only rate limiting is worth naming; every other outcome reports the
      // same thing so the screen cannot confirm which addresses have accounts.
      if (error && /rate limit/i.test(String(error.message))) return failAuth(error);
      setPhase("idle");
      setMessage(
        "If that email has a FastTrack account, a reset link is on its way. Open it on any device, set a new password, then sign in here.",
      );
    } catch (e: unknown) {
      setPhase("error");
      setMessage(syncErrorMessage(e));
    }
  };

  /**
   * Erases the cloud account. Apple requires an in-app path to this for any
   * app that lets you create an account (guideline 5.1.1(v)); it is also the
   * erasure right under GDPR/CCPA. Books on this phone are untouched — the
   * local database is the source of truth, the cloud copy is the mirror.
   */
  const startDelete = async () => {
    setPhase("authing");
    setMessage(null);
    setSummary(null);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      // Credentials are checked before the prompt appears, so typing someone
      // else's address gets an auth failure and never a destructive dialog.
      if (error) return failAuth(error);
      const token = data.session?.access_token;
      const verified = data.user?.email;
      if (!token || !verified) {
        setPhase("error");
        setMessage("Confirm your email address first, then try again.");
        return;
      }

      setPhase("idle");
      Alert.alert(
        "Delete this account?",
        `This permanently erases ${verified} and every record synced to it. Your books stay on this phone. This cannot be undone.`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {
              void supabase.auth.signOut({ scope: "local" });
            },
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              void eraseAccount(token);
            },
          },
        ],
      );
    } catch (e: unknown) {
      setPhase("error");
      setMessage(syncErrorMessage(e));
    }
  };

  const eraseAccount = async (token: string) => {
    setPhase("authing");
    try {
      const { error } = await getAuthedSupabase(token).rpc("delete_own_account");
      if (error) {
        setPhase("error");
        setMessage(syncErrorMessage(error));
        return;
      }

      // scope:"local" — the session belongs to a user that no longer exists, so
      // a server-side logout is guaranteed to 403 and would leave the dead
      // token sitting on the device.
      await getSupabase().auth.signOut({ scope: "local" });
      setPassword("");
      setPhase("done");
      setMessage(
        "Your cloud account and every synced record have been deleted. Your books are still on this phone, and you can create a new account whenever you want.",
      );
    } catch (e: unknown) {
      setPhase("error");
      setMessage(syncErrorMessage(e));
    }
  };

  const isBusy = phase === "authing" || phase === "pushing";
  const hasCredentials = email.trim().length > 0 && password.length > 0;

  return (
    <View style={styles.root}>
      <ScreenGlow />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Back">
          <Icon name="back" size={18} color={colors.slate} />
        </Pressable>
        <HomeButton />
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
      {mode === "signin" ? (
        <>
          <Pressable onPress={sendReset} disabled={isBusy} accessibilityRole="button">
            <Text style={styles.switchMode}>Forgot password?</Text>
          </Pressable>
          <Pressable
            onPress={startDelete}
            disabled={isBusy || !hasCredentials}
            accessibilityRole="button"
            accessibilityLabel="Delete cloud account"
          >
            <Text style={[styles.danger, !hasCredentials && styles.dangerDisabled]}>
              Delete cloud account
            </Text>
          </Pressable>
        </>
      ) : null}

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
  danger: {
    marginTop: 18,
    fontSize: 13,
    fontFamily: fonts.sans700,
    color: colors.red,
    textAlign: "center",
  },
  dangerDisabled: {
    opacity: 0.4,
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
