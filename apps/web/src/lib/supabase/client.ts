"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireEnv } from "@/lib/env";

/** Browser Supabase client — auth forms and the settings screen only. */
export function createClient() {
  return createBrowserClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}
