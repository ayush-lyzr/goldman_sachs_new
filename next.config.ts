import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Do NOT externalize mongoose/mongodb - Next.js will bundle them with all dependencies
  // Externalizing causes missing dependency errors (like 'kareem') in Lambda/serverless environments
};

export default nextConfig;
