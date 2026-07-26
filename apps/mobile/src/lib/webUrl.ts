/**
 * Base URL of the deployed web dashboard. Backs the paywall's legal links and
 * the password-recovery link, so both stay pointed at one place when the
 * deployment moves.
 */
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "https://fasttrack-web-ten.vercel.app";
