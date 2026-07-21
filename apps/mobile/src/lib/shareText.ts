import { Platform, Share } from "react-native";

/**
 * Shares plain text through the OS share sheet (thin device util, untested by
 * design). Native uses React Native's Share; web tries the Web Share API and
 * falls back to the clipboard so the message is never lost. Returns whether the
 * text reached a share target vs. a clipboard fallback, so callers can tell the
 * user what happened.
 */
export async function shareText(message: string): Promise<"shared" | "copied"> {
  if (Platform.OS === "web") {
    const nav = globalThis.navigator as
      | (Navigator & { share?: (data: { text: string }) => Promise<void> })
      | undefined;
    if (nav?.share) {
      await nav.share({ text: message });
      return "shared";
    }
    await nav?.clipboard?.writeText(message);
    return "copied";
  }
  await Share.share({ message });
  return "shared";
}
