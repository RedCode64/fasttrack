/**
 * Values shared between client components and server actions.
 *
 * These cannot live in lib/actions.ts: a `"use server"` module may only export
 * async functions, so a plain constant there fails the build the moment a
 * client component imports it.
 */

/** Typed into the confirm box before an account can be destroyed. */
export const DELETE_CONFIRMATION = "DELETE";
