import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Create/Edit restaurant dialogs submit multipart images (max 5 MB) plus fields.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
