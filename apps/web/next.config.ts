import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TS-built ESM; let Next transpile them in-place.
  transpilePackages: ["@fasttrack/core", "@fasttrack/schema"],
};

export default nextConfig;
