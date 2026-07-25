import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { ScreenGlow } from "@/components/ScreenGlow";
import { GhostButton, PrimaryButton } from "@/components/ui/Buttons";
import { Icon } from "@/components/ui/Icon";
import { useDb, useQuery } from "@/db/DbProvider";
import { getEstimate, sendEstimate } from "@/db/repos/estimateRepo";
import { getInvoice, sendInvoice } from "@/db/repos/invoiceRepo";
import { estimatePdfInput, invoicePdfInput, receiptPdfInput } from "@/lib/docPdf";
import { buildDocumentHtml, documentFileName, type PdfDocumentInput } from "@/lib/pdf";
import { sharePdf } from "@/lib/printPdf";
import { useEntitlement } from "@/subscriptions/SubscriptionProvider";
import { colors, fonts, spacing } from "@/theme";

type PreviewKind = "estimate" | "invoice" | "receipt";

const TITLE: Record<PreviewKind, string> = {
  estimate: "ESTIMATE PREVIEW",
  invoice: "INVOICE PREVIEW",
  receipt: "RECEIPT PREVIEW",
};

/**
 * Shows the customer-facing document exactly as it will print, then offers to
 * send it — the same HTML that `buildDocumentHtml` hands to the printer is what
 * renders here, so there is no second layout to keep in sync.
 */
export default function PreviewScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: PreviewKind; id: string }>();
  const { org, mutate } = useDb();
  const router = useRouter();
  const { isPro } = useEntitlement();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isEstimate = kind === "estimate";
  const estimate = useQuery(
    (c) => (isEstimate ? getEstimate(c, id) : Promise.resolve(null)),
    [id, isEstimate],
  );
  const invoice = useQuery(
    (c) => (isEstimate ? Promise.resolve(null) : getInvoice(c, id)),
    [id, isEstimate],
  );

  const detailError = estimate.error ?? invoice.error;
  let input: PdfDocumentInput | null = null;
  if (org) {
    if (isEstimate && estimate.data) {
      input = estimatePdfInput(org, estimate.data, isPro);
    } else if (!isEstimate && invoice.data) {
      input =
        kind === "receipt"
          ? receiptPdfInput(org, invoice.data, isPro)
          : invoicePdfInput(org, invoice.data, isPro);
    }
  }

  const send = async () => {
    if (!input) return;
    setBusy(true);
    setError(null);
    try {
      await sharePdf(buildDocumentHtml(input), documentFileName(input));
      // Sharing a draft is what "sent" means in this app — a receipt is a
      // record of money already taken, so it never changes status.
      if (isEstimate && estimate.data?.estimate.status === "draft") {
        await mutate((c) => sendEstimate(c, id));
      } else if (kind === "invoice" && invoice.data?.invoice.status === "draft") {
        await mutate((c) => sendInvoice(c, id));
      }
      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not share the document");
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenGlow />
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Close preview">
          <Icon name="back" size={18} color={colors.slate} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>{TITLE[kind ?? "estimate"]}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {input ? input.docNumber : "Loading…"}
          </Text>
        </View>
      </View>

      <View style={styles.paper}>
        {input === null ? (
          <Text style={styles.loading}>{detailError ?? "Building the document…"}</Text>
        ) : Platform.OS === "web" ? (
          // react-native-webview is native-only; in the browser the print
          // dialog already renders the exact document, so use that instead of
          // its "unsupported platform" placeholder.
          <View style={styles.webFallback}>
            <Text style={styles.loading}>
              On the web the document opens in your browser&apos;s print preview. On a
              phone it renders right here.
            </Text>
            <GhostButton
              label="Open print preview"
              onPress={() => void Print.printAsync({ html: buildDocumentHtml(input) })}
            />
          </View>
        ) : (
          <WebView
            originWhitelist={["*"]}
            source={{ html: buildDocumentHtml(input) }}
            style={styles.web}
            // The document is a fixed-width Letter page; let it scale to fit
            // the phone rather than forcing a sideways scroll.
            scalesPageToFit
            showsHorizontalScrollIndicator={false}
          />
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <GhostButton label="Close" onPress={() => router.back()} style={styles.close} />
        <PrimaryButton
          label={kind === "receipt" ? "Send receipt" : "Send"}
          icon="pdf"
          onPress={send}
          disabled={busy || !input}
          style={styles.send}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
    fontSize: 17,
    fontFamily: fonts.sans700,
    letterSpacing: -0.3,
    color: colors.ink,
    marginTop: 1,
  },
  // A light sheet on the dark theme: the document itself is a printed page, so
  // it should read as paper rather than as another dark card.
  paper: {
    flex: 1,
    marginHorizontal: spacing.screenX,
    borderRadius: spacing.cardRadius,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  web: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  loading: {
    padding: 20,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.sans500,
    color: "#555555",
  },
  webFallback: {
    flex: 1,
    justifyContent: "center",
    padding: 12,
    gap: 4,
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
    marginTop: 14,
    marginBottom: Platform.OS === "ios" ? 34 : 18,
  },
  close: {
    flex: 1,
  },
  send: {
    flex: 1.4,
  },
});
