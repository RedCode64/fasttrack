import * as Print from "expo-print";
import { Platform } from "react-native";
import * as Sharing from "expo-sharing";

/**
 * Thin device wrapper around expo-print/expo-sharing (untested by design —
 * everything interesting lives in the pure pdf.ts builder). On web the
 * browser print dialog stands in for the share sheet.
 */
export async function sharePdf(html: string): Promise<void> {
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
}
