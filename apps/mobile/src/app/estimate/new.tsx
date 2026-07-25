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

import { ScreenGlow } from "@/components/ScreenGlow";
import { PrimaryButton } from "@/components/ui/Buttons";
import { HomeButton } from "@/components/ui/HomeButton";
import { Icon } from "@/components/ui/Icon";
import { useDb, useQuery } from "@/db/DbProvider";
import { listClients } from "@/db/repos/clientRepo";
import { createDraft, listEstimates } from "@/db/repos/estimateRepo";
import { listInvoices } from "@/db/repos/invoiceRepo";
import { canAddClient, canAddDocument } from "@/lib/gating";
import { useEntitlement } from "@/subscriptions/SubscriptionProvider";
import { colors, fonts, spacing } from "@/theme";

type ClientMode = "new" | "existing";

/** Decision 7: client + job title → draft estimate (job created implicitly). */
export default function NewEstimate() {
  const { org, mutate } = useDb();
  const router = useRouter();
  const orgId = org?.id ?? "";
  const clients = useQuery((c) => (orgId ? listClients(c, orgId) : Promise.resolve([])), [orgId]);
  const { isPro } = useEntitlement();
  const estimates = useQuery(
    (c) => (orgId ? listEstimates(c, orgId) : Promise.resolve([])),
    [orgId],
  );
  const invoices = useQuery(
    (c) => (orgId ? listInvoices(c, orgId, "all") : Promise.resolve([])),
    [orgId],
  );

  const [mode, setMode] = useState<ClientMode>("new");
  const [newClientName, setNewClientName] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canCreate =
    jobTitle.trim().length > 0 &&
    (mode === "new" ? newClientName.trim().length > 0 : clientId !== null);

  const create = async () => {
    const clientCount = clients.data?.length ?? 0;
    const docCount = (estimates.data?.length ?? 0) + (invoices.data?.length ?? 0);
    if (mode === "new" && !canAddClient(clientCount, isPro)) {
      router.push("/paywall");
      return;
    }
    if (!canAddDocument(docCount, isPro)) {
      router.push("/paywall");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const estimate = await mutate((c) =>
        createDraft(
          c,
          orgId,
          mode === "new"
            ? { newClientName: newClientName.trim(), jobTitle: jobTitle.trim() }
            : { clientId: clientId ?? "", jobTitle: jobTitle.trim() },
        ),
      );
      router.replace({ pathname: "/estimate/[id]", params: { id: estimate.id } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not create the estimate");
      setBusy(false);
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
          <Text style={styles.kicker}>NEW ESTIMATE</Text>
          <Text style={styles.title}>Who's the work for?</Text>
        </View>
      </View>

      <View style={styles.segment}>
        {(
          [
            ["new", "New client"],
            ["existing", "Existing client"],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            style={[styles.segmentItem, mode === value && styles.segmentActive]}
            onPress={() => setMode(value)}
          >
            <Text style={[styles.segmentText, mode === value && styles.segmentTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === "new" ? (
        <>
          <Text style={styles.label}>Client name</Text>
          <TextInput
            style={styles.input}
            value={newClientName}
            onChangeText={setNewClientName}
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>Pick a client</Text>
          <View style={styles.chips}>
            {clients.data?.map((client) => {
              const active = clientId === client.id;
              return (
                <Pressable
                  key={client.id}
                  onPress={() => setClientId(client.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {client.name}
                  </Text>
                </Pressable>
              );
            })}
            {clients.data && clients.data.length === 0 ? (
              <Text style={styles.hint}>No clients yet — add one as a new client.</Text>
            ) : null}
          </View>
        </>
      )}

      <Text style={styles.label}>Job title</Text>
      <TextInput
        style={styles.input}
        value={jobTitle}
        onChangeText={setJobTitle}
      />
      <Text style={styles.hint}>This creates the job — every document hangs off it.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label={busy ? "Creating…" : "Create draft"}
        onPress={create}
        disabled={busy || !canCreate}
        style={styles.submit}
      />
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
    paddingBottom: 18,
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
  segment: {
    flexDirection: "row",
    gap: 8,
  },
  segmentItem: {
    flex: 1,
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
    color: colors.white,
  },
  hint: {
    fontSize: 11.5,
    fontFamily: fonts.sans500,
    color: colors.faint,
    marginTop: 7,
  },
  error: {
    marginTop: 14,
    fontSize: 12.5,
    fontFamily: fonts.sans600,
    color: colors.red,
  },
  submit: {
    marginTop: 24,
  },
});
