import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Push-only client: no persisted session (no AsyncStorage dep, Expo Go safe),
 * the user signs in per sync session. EXPO_PUBLIC_ vars come from apps/mobile/.env.
 */
function readEnv(): { url: string; key: string } {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Cloud sync is not configured (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY)");
  }
  return { url, key };
}

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const { url, key } = readEnv();
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}

/**
 * A client that stamps the given user access token on EVERY PostgREST request
 * (supabase-js `accessToken` option). Sign-in happens on getSupabase(); the
 * push must run through THIS client so writes hit RLS as `authenticated`, not
 * `anon` — otherwise the very first insert fails the authenticated-only
 * policies with "new row violates row-level security policy".
 */
export function getAuthedSupabase(accessToken: string): SupabaseClient {
  const { url, key } = readEnv();
  return createClient(url, key, {
    accessToken: async () => accessToken,
  });
}
