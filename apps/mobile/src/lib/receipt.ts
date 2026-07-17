import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

/**
 * Receipt photo persistence (thin device util, untested by design).
 * Native: copies the picked image into documentDirectory/receipts and stores
 * a RELATIVE path so rows survive iOS container moves (Plan 5's sync will
 * upload from it). Web preview: keeps the picked blob/data URI as-is.
 */

const RECEIPTS_DIR = "receipts";

export function persistReceipt(pickedUri: string, id: string): string {
  if (Platform.OS === "web") {
    return pickedUri;
  }
  const dir = new Directory(Paths.document, RECEIPTS_DIR);
  if (!dir.exists) {
    dir.create();
  }
  const destination = new File(dir, `${id}.jpg`);
  new File(pickedUri).copy(destination);
  return `${RECEIPTS_DIR}/${id}.jpg`;
}

/** Stored path → something an <Image> can render. */
export function resolveReceiptUri(path: string): string {
  if (/^(https?|blob|data|file):/.test(path)) {
    return path;
  }
  return new File(Paths.document, path).uri;
}
