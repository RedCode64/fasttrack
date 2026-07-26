import type { NextConfig } from "next";

/**
 * Baseline security headers.
 *
 * These are the origin-wide, per-request-invariant ones, so they live here and
 * cover static assets too. The Content-Security-Policy is set in middleware
 * instead — it carries a per-request nonce, which a static config cannot mint.
 */
const securityHeaders = [
  // Belt and braces with CSP `frame-ancestors 'none'`: this covers browsers
  // that still honour the older header. The dashboard is never framed.
  { key: "X-Frame-Options", value: "DENY" },
  // Stop the browser second-guessing our Content-Type (MIME-confusion XSS).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the full URL only to ourselves; other origins see the bare origin, so
  // client ids and record ids in the path never travel off-site.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The dashboard reads no sensors. The mobile app is where the camera lives.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Vercel already sends this at the edge; declaring it keeps the guarantee if
  // the deployment ever moves somewhere that does not.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Workspace packages ship TS-built ESM; let Next transpile them in-place.
  transpilePackages: ["@fasttrack/core", "@fasttrack/schema"],

  // Error responses are generic by design (see src/lib/errors.ts); the version
  // banner is one more free detail an attacker does not need.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
