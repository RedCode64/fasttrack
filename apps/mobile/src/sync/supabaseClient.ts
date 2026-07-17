import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Push-only client: no persisted session (no AsyncStorage dep, Expo Go safe),
 * the user signs in per sync session. EXPO_PUBLIC_ vars come from apps/mobile/.env.
 */
export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Cloud sync is not configured (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY)");
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}
