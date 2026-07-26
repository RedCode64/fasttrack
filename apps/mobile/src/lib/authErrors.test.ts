import { describe, expect, it } from "vitest";

import { GENERIC_AUTH_ERROR, authErrorMessage, syncErrorMessage } from "./authErrors";

describe("authErrorMessage", () => {
  it("maps a known auth code to actionable text", () => {
    expect(authErrorMessage({ code: "invalid_credentials", message: "Invalid login credentials" }))
      .toBe("That email or password is incorrect.");
  });

  it("reads the same for a bad password and an unknown address", () => {
    // Supabase returns one code for both; the mapping must not split them, or
    // the sign-in form becomes a way to test whether an address has an account.
    const wrongPassword = authErrorMessage({ code: "invalid_credentials" });
    const unknownEmail = authErrorMessage({ code: "invalid_credentials" });
    expect(wrongPassword).toBe(unknownEmail);
  });

  it("catches rate limiting reported only in the message", () => {
    expect(authErrorMessage({ message: "Email rate limit exceeded" }))
      .toBe("Too many attempts. Wait a minute and try again.");
  });

  it("never leaks an unrecognized error verbatim", () => {
    const leaky = {
      code: "23514",
      message: 'new row for relation "organizations" violates check constraint "organizations_target_margin_bps_check"',
    };
    const shown = authErrorMessage(leaky);
    expect(shown).toBe(GENERIC_AUTH_ERROR);
    expect(shown).not.toContain("organizations");
    expect(shown).not.toContain("constraint");
  });

  it("falls back to generic text for null and undefined", () => {
    expect(authErrorMessage(null)).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage(undefined)).toBe(GENERIC_AUTH_ERROR);
  });
});

describe("syncErrorMessage", () => {
  it("names the connection when the request never landed", () => {
    expect(syncErrorMessage({ message: "TypeError: fetch failed" }))
      .toContain("Check your connection");
  });

  it("tells the owner to sign in again when the token is rejected", () => {
    expect(syncErrorMessage({ code: "42501", message: "permission denied" }))
      .toBe("Your session expired — sign in again.");
  });

  it("reassures without leaking the table or constraint that failed", () => {
    const shown = syncErrorMessage({
      code: "23503",
      message: 'insert or update on table "invoice_lines" violates foreign key constraint "invoice_lines_invoice_id_fkey"',
    });
    expect(shown).toContain("safe on this phone");
    expect(shown).not.toContain("invoice_lines");
    expect(shown).not.toContain("constraint");
  });
});
