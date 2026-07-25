import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import { Platform } from "react-native";
import * as Sharing from "expo-sharing";

/**
 * Thin device wrapper around expo-print/expo-sharing (untested by design —
 * everything interesting lives in the pure pdf.ts builder). On web the
 * browser print dialog stands in for the share sheet.
 *
 * The printer writes to a generated temp path, so the rendered PDF is moved to
 * `filename` before sharing: whatever is on disk is what the client sees
 * attached in their mail app. Build the name with `documentFileName`.
 */
export async function sharePdf(html: string, filename: string): Promise<void> {
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const printed = new File(uri);
  const target = new File(Paths.cache, filename);
  if (target.exists) target.delete();
  await printed.move(target);
  await Sharing.shareAsync(target.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
}
