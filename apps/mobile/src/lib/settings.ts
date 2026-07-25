import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";

/**
 * Device-local app settings (thin util, untested by design). Holds the
 * tradesperson's own "pay me" link so it never has to round-trip a schema
 * migration or leave the phone. Native persists a small JSON file next to the
 * receipts; web falls back to localStorage. Reads and writes are synchronous
 * so screens can hydrate without a loading flash.
 */

const SETTINGS_FILE = "settings.json";
const WEB_KEY = "fasttrack-settings";

export interface AppSettings {
  /** Venmo/Zelle/PayPal.me/Stripe link surfaced on payment requests. */
  readonly payLink: string | null;
}

const EMPTY: AppSettings = { payLink: null };

function coerce(raw: unknown): AppSettings {
  if (raw && typeof raw === "object" && "payLink" in raw) {
    const value = (raw as { payLink: unknown }).payLink;
    return { payLink: typeof value === "string" && value.trim() ? value.trim() : null };
  }
  return EMPTY;
}

export function loadSettings(): AppSettings {
  try {
    if (Platform.OS === "web") {
      const stored = globalThis.localStorage?.getItem(WEB_KEY);
      return stored ? coerce(JSON.parse(stored)) : EMPTY;
    }
    const file = new File(Paths.document, SETTINGS_FILE);
    if (!file.exists) return EMPTY;
    return coerce(JSON.parse(file.textSync()));
  } catch {
    return EMPTY; // corrupt/unreadable settings must never crash a screen
  }
}

/** Drops device-local settings — part of a full app-data reset. */
export function clearSettings(): void {
  try {
    if (Platform.OS === "web") {
      globalThis.localStorage?.removeItem(WEB_KEY);
      return;
    }
    const file = new File(Paths.document, SETTINGS_FILE);
    if (file.exists) file.delete();
  } catch {
    // Nothing to recover: a settings file we cannot remove is still overwritten
    // by the next saveSettings, and the reset itself must not fail on it.
  }
}

export function saveSettings(settings: AppSettings): void {
  const payload = JSON.stringify(coerce(settings));
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(WEB_KEY, payload);
    return;
  }
  const file = new File(Paths.document, SETTINGS_FILE);
  if (!file.exists) file.create();
  file.write(payload);
}
