import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenGlow } from "@/components/ScreenGlow";
import { GhostButton, PrimaryButton } from "@/components/ui/Buttons";
import { HomeButton } from "@/components/ui/HomeButton";
import { Icon } from "@/components/ui/Icon";
import { useDb, useQuery } from "@/db/DbProvider";
import {
  createExpense,
  deleteExpense,
  getExpense,
  listCategories,
  updateExpense,
} from "@/db/repos/expenseRepo";
import { listJobs } from "@/db/repos/jobRepo";
import { dollarsToCents } from "@/lib/parse";
import { persistReceipt, resolveReceiptUri } from "@/lib/receipt";
import { colors, fonts, spacing } from "@/theme";

export interface ExpenseFormProps {
  /** Present when editing; absent for capture. */
  readonly expenseId?: string;
}

/** The capture/edit form behind /expense/new and /expense/[id] (design screen 7). */
export function ExpenseForm({ expenseId }: ExpenseFormProps) {
  const { org, mutate } = useDb();
  const router = useRouter();
  const orgId = org?.id ?? "";
  const isEdit = expenseId !== undefined;

  const categories = useQuery(
    (c) => (orgId ? listCategories(c, orgId) : Promise.resolve([])),
    [orgId],
  );
  const jobs = useQuery((c) => (orgId ? listJobs(c, orgId) : Promise.resolve([])), [orgId]);
  const existing = useQuery(
    (c) => (expenseId ? getExpense(c, expenseId) : Promise.resolve(null)),
    [expenseId],
  );

  const [seeded, setSeeded] = useState(false);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [storedPath, setStoredPath] = useState<string | null>(null);
  const [amountText, setAmountText] = useState("");
  const [vendor, setVendor] = useState("");
  const [spentAt, setSpentAt] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [billable, setBillable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isEdit && existing.data && !seeded) {
    setSeeded(true);
    setAmountText((existing.data.amount_cents / 100).toFixed(2));
    setVendor(existing.data.vendor ?? "");
    setSpentAt(existing.data.spent_at);
    setCategoryId(existing.data.category_id);
    setJobId(existing.data.job_id);
    setBillable(existing.data.is_billable);
    setStoredPath(existing.data.receipt_storage_path);
  }

  const pick = async (source: "camera" | "library") => {
    setError(null);
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.7,
      };
      let result: ImagePicker.ImagePickerResult;
      if (source === "camera") {
        await ImagePicker.requestCameraPermissionsAsync();
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }
      const asset = result.canceled ? null : result.assets[0];
      if (asset) setPickedUri(asset.uri);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not open the picker");
    }
  };

  const save = async () => {
    const amountCents = dollarsToCents(amountText);
    if (amountCents === null || amountCents <= 0) {
      setError("Enter the amount.");
      return;
    }
    if (!categoryId) {
      setError("Pick a category.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(spentAt)) {
      setError("Date must be YYYY-MM-DD.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await mutate(async (c) => {
        const receiptPath = pickedUri ? persistReceipt(pickedUri, c.newId()) : storedPath;
        if (isEdit && expenseId) {
          await updateExpense(c, expenseId, {
            amountCents,
            vendor: vendor.trim() || null,
            spentAt,
            categoryId,
            jobId,
            isBillable: billable,
            receiptPath,
          });
        } else {
          await createExpense(c, orgId, {
            amountCents,
            vendor: vendor.trim() || undefined,
            spentAt,
            categoryId,
            jobId: jobId ?? undefined,
            isBillable: billable,
            receiptPath: receiptPath ?? undefined,
          });
        }
      });
      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save the expense");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!expenseId) return;
    setBusy(true);
    try {
      await mutate((c) => deleteExpense(c, expenseId));
      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not delete the expense");
      setBusy(false);
    }
  };

  const previewUri = pickedUri ?? (storedPath ? resolveReceiptUri(storedPath) : null);

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
          <Text style={styles.kicker}>{isEdit ? "EDIT EXPENSE" : "NEW EXPENSE"}</Text>
          <Text style={styles.title}>{isEdit ? "Fix the details" : "Log the spend"}</Text>
        </View>
      </View>

      <View style={styles.photoBox}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={styles.photoEmpty}>
            <Icon name="cam" size={26} color={colors.faint} />
            <Text style={styles.photoHint}>Attach the receipt</Text>
          </View>
        )}
        <View style={styles.photoActions}>
          {Platform.OS !== "web" ? (
            <GhostButton label="Camera" icon="cam" onPress={() => pick("camera")} disabled={busy} style={styles.photoButton} />
          ) : null}
          <GhostButton
            label={previewUri ? "Retake" : "Choose photo"}
            onPress={() => pick("library")}
            disabled={busy}
            style={styles.photoButton}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>Amount $</Text>
          <TextInput
            style={styles.input}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            placeholder="412.00"
            placeholderTextColor={colors.faint}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            value={spentAt}
            onChangeText={setSpentAt}
            placeholder="2026-07-16"
            placeholderTextColor={colors.faint}
          />
        </View>
      </View>

      <Text style={styles.label}>Vendor</Text>
      <TextInput
        style={styles.input}
        value={vendor}
        onChangeText={setVendor}
        placeholder="City Electric Supply"
        placeholderTextColor={colors.faint}
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.chips}>
        {categories.data?.map((category) => {
          const active = categoryId === category.id;
          return (
            <Pressable
              key={category.id}
              onPress={() => setCategoryId(category.id)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Job</Text>
      <View style={styles.chips}>
        <Pressable
          onPress={() => {
            setJobId(null);
            setBillable(false);
          }}
          style={[styles.chip, jobId === null && styles.chipActive]}
        >
          <Text style={[styles.chipText, jobId === null && styles.chipTextActive]}>
            Overhead
          </Text>
        </Pressable>
        {jobs.data?.map(({ job, clientName }) => {
          const active = jobId === job.id;
          return (
            <Pressable
              key={job.id}
              onPress={() => setJobId(job.id)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                {clientName} — {job.title}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {jobId !== null ? (
        <View style={styles.billableRow}>
          <Text style={styles.billableLabel}>Billable to job</Text>
          <Switch
            value={billable}
            onValueChange={setBillable}
            trackColor={{ true: colors.green, false: colors.borderButton }}
            thumbColor={colors.white}
          />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label={busy ? "Saving…" : isEdit ? "Save changes" : "Save expense"}
        onPress={save}
        disabled={busy}
        style={styles.submit}
      />
      {isEdit ? (
        <GhostButton label="Delete expense" onPress={remove} disabled={busy} style={styles.delete} />
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
  photoBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.cardRadius,
    padding: 12,
  },
  photo: {
    height: 150,
    borderRadius: 12,
  },
  photoEmpty: {
    height: 110,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.borderButton,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  photoHint: {
    fontSize: 12,
    fontFamily: fonts.sans600,
    color: colors.faint,
  },
  photoActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  photoButton: {
    flex: 1,
    padding: 10,
  },
  row: {
    flexDirection: "row",
    gap: 11,
  },
  field: {
    flex: 1,
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
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderButton,
    maxWidth: "100%",
  },
  chipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  chipText: {
    fontSize: 12,
    fontFamily: fonts.sans600,
    color: colors.slate,
  },
  chipTextActive: {
    color: colors.white,
  },
  billableRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  billableLabel: {
    fontSize: 13.5,
    fontFamily: fonts.sans600,
    color: colors.ink,
  },
  error: {
    marginTop: 12,
    fontSize: 12.5,
    fontFamily: fonts.sans600,
    color: colors.red,
  },
  submit: {
    marginTop: 20,
  },
  delete: {
    marginTop: 10,
  },
});
