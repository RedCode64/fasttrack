import { basisPoints, cents, lineTotal, priceFromCost } from "@fasttrack/core";
import type { LineKind } from "@fasttrack/schema";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
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
  addCustomLine,
  addLineFromPriceBook,
  getEstimate,
  removeLine,
  updateLine,
} from "@/db/repos/estimateRepo";
import { listPriceBookItems } from "@/db/repos/priceBookRepo";
import { money, pctFromBps } from "@/lib/format";
import { dollarsToCents, parseQuantity, pctToBps } from "@/lib/parse";
import { colors, fonts, spacing } from "@/theme";

const KIND_LABELS: Record<LineKind, string> = {
  material: "Material",
  labor: "Labor",
  other: "Other",
};

/** Add/edit a line: price-book picker or custom cost+markup entry. */
export default function LineEditor() {
  const { id, lineId } = useLocalSearchParams<{ id: string; lineId?: string }>();
  const { org, mutate } = useDb();
  const router = useRouter();
  const isEdit = typeof lineId === "string" && lineId.length > 0;

  const detail = useQuery((c) => getEstimate(c, id), [id]);
  const existing = isEdit ? detail.data?.lines.find((l) => l.id === lineId) : undefined;

  const orgId = org?.id ?? "";
  const items = useQuery(
    (c) => (orgId ? listPriceBookItems(c, orgId) : Promise.resolve([])),
    [orgId],
  );

  const [tab, setTab] = useState<"book" | "custom">(isEdit ? "custom" : "book");
  const [search, setSearch] = useState("");
  const [seeded, setSeeded] = useState(false);
  const [kind, setKind] = useState<LineKind>("material");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("ea");
  const [costText, setCostText] = useState("");
  const [markupText, setMarkupText] = useState("50");
  const [taxable, setTaxable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Prefill once when editing an existing line.
  if (isEdit && existing && !seeded) {
    setSeeded(true);
    setKind(existing.kind);
    setDescription(existing.description);
    setQuantity(String(existing.quantity));
    setUnit(existing.unit);
    setCostText((existing.unit_cost_cents / 100).toString());
    setMarkupText((existing.markup_pct / 100).toString());
    setTaxable(existing.is_taxable);
  }

  const costCents = dollarsToCents(costText);
  const markupBps = pctToBps(markupText);
  const qty = parseQuantity(quantity);
  let pricePreview: string | null = null;
  let totalPreview: string | null = null;
  if (costCents !== null && markupBps !== null && markupBps >= -10_000 && qty !== null) {
    try {
      const price = priceFromCost(cents(costCents), basisPoints(markupBps));
      pricePreview = money(price, { showCents: true });
      totalPreview = money(lineTotal(price, qty), { showCents: true });
    } catch {
      pricePreview = null;
    }
  }

  const pickFromBook = async (itemId: string) => {
    setBusy(true);
    setError(null);
    try {
      await mutate((c) => addLineFromPriceBook(c, id, itemId, 1));
      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not add the item");
      setBusy(false);
    }
  };

  const saveCustom = async () => {
    if (costCents === null || markupBps === null || qty === null || qty <= 0) {
      setError("Check quantity, cost, and markup — something doesn't parse.");
      return;
    }
    if (description.trim().length === 0) {
      setError("Give the line a description.");
      return;
    }
    setBusy(true);
    setError(null);
    const input = {
      kind,
      description: description.trim(),
      quantity: qty,
      unit: unit.trim() || "ea",
      unitCostCents: costCents,
      markupPct: markupBps,
      isTaxable: taxable,
    };
    try {
      if (isEdit && existing) {
        await mutate((c) => updateLine(c, existing.id, input));
      } else {
        await mutate((c) => addCustomLine(c, id, input));
      }
      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save the line");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    setBusy(true);
    try {
      await mutate((c) => removeLine(c, existing.id));
      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not delete the line");
      setBusy(false);
    }
  };

  const query = search.trim().toLowerCase();
  const filtered = (items.data ?? []).filter((i) => i.name.toLowerCase().includes(query));
  const materials = filtered.filter((i) => i.kind === "material");
  const labor = filtered.filter((i) => i.kind === "labor");

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
          <Text style={styles.kicker}>{isEdit ? "EDIT LINE ITEM" : "ADD LINE ITEM"}</Text>
          <Text style={styles.title}>{isEdit ? "Adjust cost & markup" : "Price the work"}</Text>
        </View>
      </View>

      {!isEdit ? (
        <View style={styles.segment}>
          {(
            [
              ["book", "Price book"],
              ["custom", "Custom"],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              style={[styles.segmentItem, tab === value && styles.segmentActive]}
              onPress={() => setTab(value)}
            >
              <Text style={[styles.segmentText, tab === value && styles.segmentTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {tab === "book" && !isEdit ? (
        <>
          <TextInput
            style={[styles.input, styles.search]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search your price book"
            placeholderTextColor={colors.faint}
          />
          {(
            [
              ["MATERIALS", materials],
              ["LABOR", labor],
            ] as const
          ).map(([label, group]) =>
            group.length > 0 ? (
              <View key={label}>
                <Text style={styles.groupLabel}>{label}</Text>
                {group.map((item) => (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [styles.bookRow, pressed && styles.rowPressed]}
                    onPress={() => pickFromBook(item.id)}
                    disabled={busy}
                  >
                    <View style={styles.bookText}>
                      <Text style={styles.bookName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.bookMeta}>
                        {money(item.unit_cost_cents, { showCents: true })} / {item.unit}
                      </Text>
                    </View>
                    <View style={styles.markupChip}>
                      <Text style={styles.markupText}>+{pctFromBps(item.default_markup_pct)}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null,
          )}
        </>
      ) : (
        <>
          <Text style={styles.label}>Kind</Text>
          <View style={styles.chips}>
            {(Object.keys(KIND_LABELS) as LineKind[]).map((option) => {
              const active = kind === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => {
                    setKind(option);
                    if (!isEdit) setTaxable(option === "material");
                  }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {KIND_LABELS[option]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="200A panel — Square D QO"
            placeholderTextColor={colors.faint}
          />

          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Qty</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Unit</Text>
              <TextInput style={styles.input} value={unit} onChangeText={setUnit} />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Unit cost $</Text>
              <TextInput
                style={styles.input}
                value={costText}
                onChangeText={setCostText}
                keyboardType="decimal-pad"
                placeholder="420.00"
                placeholderTextColor={colors.faint}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Markup %</Text>
              <TextInput
                style={styles.input}
                value={markupText}
                onChangeText={setMarkupText}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.taxRow}>
            <Text style={styles.taxLabel}>Taxable line</Text>
            <Switch
              value={taxable}
              onValueChange={setTaxable}
              trackColor={{ true: colors.green, false: colors.borderButton }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.preview}>
            <Text style={styles.previewLabel}>Customer price</Text>
            <Text style={styles.previewValue}>
              {pricePreview ?? "—"}
              {totalPreview ? `  ·  line total ${totalPreview}` : ""}
            </Text>
          </View>

          <PrimaryButton
            label={busy ? "Saving…" : isEdit ? "Save changes" : "Add line"}
            onPress={saveCustom}
            disabled={busy}
            style={styles.submit}
          />
          {isEdit ? (
            <GhostButton label="Delete line" onPress={remove} disabled={busy} style={styles.delete} />
          ) : null}
        </>
      )}
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
  segment: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
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
  search: {
    marginTop: 14,
  },
  groupLabel: {
    fontSize: 11,
    fontFamily: fonts.sans700,
    letterSpacing: 0.8,
    color: colors.faint,
    marginTop: 18,
    marginBottom: 6,
  },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.cardRadiusSm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  rowPressed: {
    backgroundColor: colors.surface2,
  },
  bookText: {
    flex: 1,
  },
  bookName: {
    fontSize: 13.5,
    fontFamily: fonts.sans600,
    color: colors.ink,
  },
  bookMeta: {
    fontSize: 11.5,
    fontFamily: fonts.sans500,
    color: colors.muted,
    marginTop: 2,
  },
  markupChip: {
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
  row: {
    flexDirection: "row",
    gap: 11,
  },
  field: {
    flex: 1,
  },
  taxRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  taxLabel: {
    fontSize: 13.5,
    fontFamily: fonts.sans600,
    color: colors.ink,
  },
  preview: {
    marginTop: 14,
    backgroundColor: colors.greenWash,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  previewLabel: {
    fontSize: 11,
    fontFamily: fonts.sans600,
    color: colors.green,
  },
  previewValue: {
    fontSize: 14,
    fontFamily: fonts.mono600,
    color: colors.greenDark,
    marginTop: 2,
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
