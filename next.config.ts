import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "25mb" }, // cleaner photo uploads
  },
};

export default nextConfig;
