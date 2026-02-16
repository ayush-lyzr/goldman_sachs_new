import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Ensure mongoose and mongodb dependencies are included in serverless bundle
  experimental: {
    serverComponentsExternalPackages: ["mongodb", "mongoose"],
  },
};

export default nextConfig;
