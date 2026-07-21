import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import * as Sharing from "expo-sharing";

/**
 * Writes a CSV string to a file and hands it to the OS share sheet (thin device
 * util, untested by design — the CSV itself is built and tested in csvExport).
 * Native writes into the cache dir and shares; web triggers a browser download.
 */
export async function shareCsv(filename: string, csv: string): Promise<void> {
  if (Platform.OS === "web") {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = globalThis.document?.createElement("a");
    if (anchor) {
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
    }
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    UTI: "public.comma-separated-values-text",
    dialogTitle: "Export for your accountant",
  });
}
