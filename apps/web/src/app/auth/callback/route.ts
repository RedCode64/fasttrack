import { NextResponse, type NextRequest } from "next/server";
import { logServerError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for emailed auth links (password recovery, email confirmation).
 *
 * Supabase sends the user here with a PKCE `code`; exchanging it sets the
 * session cookies, after which `next` is safe to render. `next` is constrained
 * to a same-origin path so a crafted link cannot turn a real FastTrack email
 * into an open redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=link_invalid`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    logServerError("auth callback exchange", error);
    return NextResponse.redirect(`${origin}/login?error=link_expired`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

/** Only same-origin absolute paths pass; anything else falls back to home. */
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  // Reject protocol-relative ("//evil.com") and absolute URLs outright.
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}
