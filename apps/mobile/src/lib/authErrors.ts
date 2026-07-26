/**
 * Turns Supabase auth/sync failures into text worth showing a tradesperson.
 *
 * Raw errors carry Postgres constraint and table names; those belong in a log,
 * not on a phone screen. Anything unrecognized collapses to one generic line.
 *
 * Mirrors apps/web/src/lib/errors.ts — the two apps cannot share client code,
 * and a lookup table is cheaper to duplicate than a package to maintain.
 */

const GENERIC = "Something went wrong. Check your connection and try again.";

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
  return typeof message === "string" ? message : "";
}

/**
 * Safe to show verbatim: actionable, free of internals, and non-enumerating —
 * a wrong password and an unknown address both read `invalid_credentials`.
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
};

/** Maps a Supabase auth error to safe display text. */
export function authErrorMessage(error: unknown): string {
  if (!error) return GENERIC;
  const mapped = AUTH_MESSAGES[codeOf(error)];
  if (mapped) return mapped;
  if (/rate limit|too many requests/i.test(messageOf(error))) {
    return AUTH_MESSAGES.over_request_rate_limit;
  }
  return GENERIC;
}

/**
 * Sync writes fail for reasons the owner can act on (offline, expired session)
 * and reasons they cannot (a constraint they never see). Name only the former.
 */
export function syncErrorMessage(error: unknown): string {
  const code = codeOf(error);
  const message = messageOf(error);

  if (/network|fetch failed|timeout/i.test(message)) {
    return "Could not reach the cloud. Check your connection and try again.";
  }
  if (code === "42501" || code === "PGRST301" || /jwt|token/i.test(message)) {
    return "Your session expired — sign in again.";
  }
  return "Sync could not finish. Your books are safe on this phone — try again in a moment.";
}

export { GENERIC as GENERIC_AUTH_ERROR };
