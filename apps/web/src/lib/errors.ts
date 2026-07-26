/**
 * User-facing error text.
 *
 * Database and auth internals must never reach the browser: constraint names,
 * table names and Postgres error text tell an attacker the shape of the schema.
 * Everything unrecognized collapses to one generic line; the real error is
 * logged server-side where only we can read it.
 */

const GENERIC = "Something went wrong. Please try again.";

interface ErrorLike {
  readonly message?: unknown;
  readonly code?: unknown;
}

function codeOf(error: unknown): string {
  const code = (error as ErrorLike | null)?.code;
  return typeof code === "string" ? code : "";
}

function messageOf(error: unknown): string {
  const message = (error as ErrorLike | null)?.message;
  return typeof message === "string" ? message : String(error);
}

/**
 * Auth failures safe to show verbatim: actionable, free of internals, and
 * deliberately non-enumerating — a wrong password and an unknown address both
 * return `invalid_credentials`, so the form cannot be used to discover who has
 * an account.
 */
const AUTH_MESSAGES: Readonly<Record<string, string>> = {
  invalid_credentials: "That email or password is incorrect.",
  email_not_confirmed: "Confirm your email first — check your inbox for the link.",
  email_address_invalid: "Enter a valid email address.",
  weak_password: "Pick a stronger password — at least 8 characters.",
  same_password: "That is already your current password.",
  otp_expired: "That link has expired. Request a new one.",
  over_request_rate_limit: "Too many attempts. Wait a minute and try again.",
  over_email_send_rate_limit: "Too many emails sent. Wait a few minutes and try again.",
  signup_disabled: "New accounts are not being accepted right now.",
  session_not_found: "Your session expired — sign in again.",
};

/** Maps a Supabase auth error to safe display text. */
export function authErrorMessage(error: unknown): string {
  if (!error) return GENERIC;
  const mapped = AUTH_MESSAGES[codeOf(error)];
  if (mapped) return mapped;
  // Older supabase-js releases report rate limiting in the message only.
  if (/rate limit|too many requests/i.test(messageOf(error))) {
    return AUTH_MESSAGES.over_request_rate_limit;
  }
  logServerError("auth", error);
  return GENERIC;
}

/**
 * Maps a PostgREST/Postgres error to safe display text. Only conditions the
 * user can actually resolve get their own message; the rest is generic.
 *
 * Postgres error codes: 23505 unique_violation, 23503 foreign_key_violation,
 * 23514 check_violation, 42501 insufficient_privilege (an RLS denial).
 */
export function dbErrorMessage(context: string, error: unknown): string {
  const code = codeOf(error);
  logServerError(context, error);

  if (code === "23505") return "That record already exists.";
  if (code === "23503") return "That selection is no longer available — reload and try again.";
  if (code === "23514") return "One of those values is out of range. Check the form and try again.";
  if (code === "42501" || code === "PGRST301") {
    return "You do not have access to that. Sign in again.";
  }
  return GENERIC;
}

/**
 * Writes full error detail to the server log. Next.js server output is captured
 * by the host (Vercel), so this is the private half of every sanitized message.
 */
export function logServerError(context: string, error: unknown): void {
  const code = codeOf(error);
  console.error(`[fasttrack] ${context} failed${code ? ` (${code})` : ""}:`, error);
}

export { GENERIC as GENERIC_ERROR };
