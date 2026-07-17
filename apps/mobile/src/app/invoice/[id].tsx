import { lineTotal } from "@fasttrack/core";
import { paymentMethodSchema, type PaymentMethod } from "@fasttrack/schema";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { Icon, type IconName } from "@/components/ui/Icon";
import { useDb, useQuery } from "@/db/DbProvider";
import { getInvoice, recordPayment, sendInvoice, type DisplayStatus } from "@/db/repos/invoiceRepo";
import { invoicePdfInput } from "@/lib/docPdf";
import { docNumber, money, shortDate } from "@/lib/format";
import { dollarsToCents } from "@/lib/parse";
import { buildDocumentHtml } from "@/lib/pdf";
import { sharePdf } from "@/lib/printPdf";
import { colors, fonts, spacing, statusLabel } from "@/theme";

interface BannerSpec {
  readonly icon: IconName;
  readonly bg: string;
  readonly fg: string;
  readonly title: string;
  readonly detail: string;
}

function banner(status: DisplayStatus, balanceCents: number, dueAt: string | null): BannerSpec {
  switch (status) {
    case "paid":
      return {
        icon: "check",
        bg: colors.greenWash,
        fg: colors.green,
        title: "Paid in full",
        detail: "Nothing outstanding on this invoice.",
      };
    case "overdue":
      return {
        icon: "alert",
        bg: colors.redWash,
        fg: colors.red,
        title: "Overdue",
        detail: `${money(balanceCents)} past due${dueAt ? ` since ${shortDate(dueAt)}` : ""} — send a reminder.`,
      };
    case "partial":
      return {
        icon: "wallet",
        bg: colors.amberWash,
        fg: colors.amber,
        title: "Partially paid",
        detail: `${money(balanceCents)} still due${dueAt ? ` by ${shortDate(dueAt)}` : ""}.`,
      };
    case "draft":
      return {
        icon: "doc",
        bg: colors.grayWash,
        fg: colors.gray,
        title: "Draft",
        detail: "Send it to start the clock on payment.",
      };
    default:
      return {
        icon: "doc",
        bg: colors.blueWash,
        fg: colors.blue,
        title: statusLabel(status),
        detail: dueAt ? `Due ${shortDate(dueAt)}.` : "Awaiting payment.",
      };
  }
}

/** Invoice detail: status banner, billed-to, lines, payments, actions. */
export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { org, mutate } = useDb();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [amountText, setAmountText] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("check");
  const [reference, setReference] = useState("");

  const detail = useQuery((c) => getInvoice(c, id), [id]);

  if (!org || !detail.data) {
    return (
      <View style={styles.screen}>
        {detail.error ? <Text style={styles.error}>{detail.error}</Text> : null}
      </View>
    );
  }
  const data = detail.data;
  const status = data.displayStatus;
  const b = banner(status, data.invoice.balance_cents, data.invoice.due_at);
  const canTakePayment = status !== "draft" && status !== "paid";

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

  const viewPdf = () =>
    run(async () => {
      await sharePdf(buildDocumentHtml(invoicePdfInput(org, data)));
    });
  const send = () =>
    run(async () => {
      await sharePdf(buildDocumentHtml(invoicePdfInput(org, data)));
      await mutate((c) => sendInvoice(c, id));
    });
  const savePayment = () =>
    run(async () => {
      const amountCents = dollarsToCents(amountText);
      if (amountCents === null || amountCents <= 0) {
        throw new Error("Enter a payment amount");
      }
      await mutate((c) =>
        recordPayment(c, id, {
          amountCents,
          method,
          reference: reference.trim() || undefined,
        }),
      );
      setPaying(false);
      setAmountText("");
      setReference("");
    });

  const openPaySheet = () => {
    setAmountText((data.invoice.balance_cents / 100).toFixed(2));
    setPaying(true);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Icon name="back" size={18} color={colors.slate} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>INVOICE · {data.client.name.toUpperCase()}</Text>
          <Text style={styles.title}>{docNumber("INV", data.invoice.number)}</Text>
        </View>
        <Pressable style={styles.back} onPress={viewPdf} disabled={busy}>
          <Icon name="share" size={17} color={colors.slate} />
        </Pressable>
      </View>

      <View style={[styles.banner, { backgroundColor: b.bg }]}>
        <Icon name={b.icon} size={20} color={b.fg} strokeWidth={2.1} />
        <View style={styles.bannerText}>
          <Text style={[styles.bannerTitle, { color: b.fg }]}>{b.title}</Text>
          <Text style={styles.bannerDetail}>{b.detail}</Text>
        </View>
        <Text style={[styles.bannerAmount, { color: b.fg }]}>
          {money(data.invoice.total_cents)}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>BILLED TO</Text>
      <View style={styles.card}>
        <Text style={styles.clientName}>{data.client.name}</Text>
        <Text style={styles.clientMeta}>{data.job.title}</Text>
        {data.invoice.due_at ? (
          <Text style={styles.clientMeta}>
            Issued {data.invoice.issued_at ? shortDate(data.invoice.issued_at) : "—"} · due{" "}
            {shortDate(data.invoice.due_at)}
          </Text>
        ) : null}
      </View>

      <Text style={styles.sectionLabel}>LINE ITEMS</Text>
      <View style={styles.card}>
        {data.lines.map((line, index) => (
          <View key={line.id} style={[styles.lineRow, index > 0 && styles.lineDivider]}>
            <View style={styles.lineText}>
              <Text style={styles.lineName} numberOfLines={1}>
                {line.description}
              </Text>
              <Text style={styles.lineMeta}>
                {line.quantity} {line.unit} × {money(line.unit_price_cents, { showCents: true })}
              </Text>
            </View>
            <Text style={styles.lineAmount}>
              {money(lineTotal(line.unit_price_cents, line.quantity))}
            </Text>
          </View>
        ))}
        <View style={[styles.lineRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>
            Total{data.invoice.tax_cents > 0 ? " (incl. tax)" : ""}
          </Text>
          <Text style={styles.totalAmount}>{money(data.invoice.total_cents)}</Text>
        </View>
      </View>

      {data.payments.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>PAYMENTS</Text>
          <View style={styles.card}>
            {data.payments.map((payment, index) => (
              <View key={payment.id} style={[styles.lineRow, index > 0 && styles.lineDivider]}>
                <View style={styles.lineText}>
                  <Text style={styles.lineName}>{statusLabel(payment.method)}</Text>
                  <Text style={styles.lineMeta}>{shortDate(payment.paid_at)}</Text>
                </View>
                <Text style={styles.paymentAmount}>-{money(payment.amount_cents)}</Text>
              </View>
            ))}
            <View style={[styles.lineRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Balance</Text>
              <Text style={styles.totalAmount}>{money(data.invoice.balance_cents)}</Text>
            </View>
          </View>
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {paying ? (
        <View style={styles.paySheet}>
          <Text style={styles.payTitle}>Record payment</Text>
          <Text style={styles.label}>Amount $</Text>
          <TextInput
            style={styles.input}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>Method</Text>
          <View style={styles.methodChips}>
            {paymentMethodSchema.options.map((option) => {
              const active = method === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setMethod(option)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {statusLabel(option)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.label}>Reference (optional)</Text>
          <TextInput
            style={styles.input}
            value={reference}
            onChangeText={setReference}
            placeholder="Check #4471"
            placeholderTextColor={colors.faint}
          />
          <View style={styles.payActions}>
            <GhostButton label="Cancel" onPress={() => setPaying(false)} disabled={busy} style={styles.actionGhost} />
            <PrimaryButton label={busy ? "Saving…" : "Save payment"} onPress={savePayment} disabled={busy} style={styles.actionPrimary} />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <GhostButton label="View PDF" icon="pdf" onPress={viewPdf} disabled={busy} style={styles.actionGhost} />
          {status === "draft" ? (
            <PrimaryButton label="Send invoice" onPress={send} disabled={busy} style={styles.actionPrimary} />
          ) : null}
          {canTakePayment ? (
            <PrimaryButton label="Record payment" icon="wallet" onPress={openPaySheet} disabled={busy} style={styles.actionPrimary} />
          ) : null}
          {status === "paid" ? (
            <PrimaryButton label="Share receipt" icon="share" onPress={viewPdf} disabled={busy} style={styles.actionPrimary} />
          ) : null}
        </View>
      )}
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
    paddingBottom: 14,
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
    fontSize: 18,
    fontFamily: fonts.mono700,
    color: colors.ink,
    marginTop: 1,
  },
  banner: {
    marginHorizontal: spacing.screenX,
    borderRadius: spacing.cardRadius,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14.5,
    fontFamily: fonts.sans700,
  },
  bannerDetail: {
    fontSize: 12,
    fontFamily: fonts.sans500,
    color: colors.slate,
    marginTop: 2,
  },
  bannerAmount: {
    fontSize: 17,
    fontFamily: fonts.mono700,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: fonts.sans700,
    letterSpacing: 0.8,
    color: colors.faint,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  card: {
    marginHorizontal: spacing.screenX,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.cardRadius,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  clientName: {
    fontSize: 15,
    fontFamily: fonts.sans700,
    color: colors.ink,
    paddingTop: 8,
  },
  clientMeta: {
    fontSize: 12.5,
    fontFamily: fonts.sans500,
    color: colors.muted,
    paddingVertical: 2,
    paddingBottom: 8,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 11,
  },
  lineDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  lineText: {
    flex: 1,
  },
  lineName: {
    fontSize: 13.5,
    fontFamily: fonts.sans600,
    color: colors.ink,
  },
  lineMeta: {
    fontSize: 11.5,
    fontFamily: fonts.sans500,
    color: colors.muted,
    marginTop: 2,
  },
  lineAmount: {
    fontSize: 14,
    fontFamily: fonts.mono600,
    color: colors.ink,
  },
  paymentAmount: {
    fontSize: 14,
    fontFamily: fonts.mono600,
    color: colors.green,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.borderCircle,
  },
  totalLabel: {
    fontSize: 13.5,
    fontFamily: fonts.sans700,
    color: colors.ink,
  },
  totalAmount: {
    fontSize: 16,
    fontFamily: fonts.mono700,
    color: colors.ink,
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
  paySheet: {
    marginHorizontal: spacing.screenX,
    marginTop: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.cardRadius,
    padding: 16,
  },
  payTitle: {
    fontSize: 15,
    fontFamily: fonts.sans700,
    color: colors.ink,
  },
  label: {
    fontSize: 12,
    fontFamily: fonts.sans600,
    color: colors.slate,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.screenBg,
    borderWidth: 1,
    borderColor: colors.borderButton,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: fonts.sans600,
    color: colors.ink,
  },
  methodChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.screenBg,
    borderWidth: 1,
    borderColor: colors.borderButton,
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
    color: colors.surface,
  },
  payActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  actionGhostFlex: {
    flex: 1,
  },
});
