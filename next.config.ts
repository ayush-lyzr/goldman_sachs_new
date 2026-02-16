import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Externalize mongoose and mongodb for serverless compatibility
  serverExternalPackages: ["mongoose", "mongodb"],
  // Ensure these packages are not bundled
  experimental: {
    serverComponentsExternalPackages: ["mongoose", "mongodb"],
  },
};

export default nextConfig;
