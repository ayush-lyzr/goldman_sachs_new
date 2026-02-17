import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // For serverless deployments, use standalone output to bundle all dependencies
  // This creates a self-contained build with all node_modules included
  output: 'standalone',
  // Do NOT externalize mongoose/mongodb - they must be bundled
  serverExternalPackages: [],
  // Turbopack config (Next.js 16 uses Turbopack by default)
  turbopack: {},
};

export default nextConfig;
