"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Next.js only inlines NEXT_PUBLIC_* into the browser bundle for *literal*
 * `process.env.X` access — a dynamic `process.env[name]` (as in requireEnv)
 * stays undefined client-side. So read the two vars statically here.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Browser Supabase client — auth forms and the settings screen only. */
export function createClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase browser client is not configured (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY)");
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
