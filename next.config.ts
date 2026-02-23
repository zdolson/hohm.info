import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  trailingSlash: false,
  async redirects() {
    return [{ source: "/admin/", destination: "/admin", permanent: true }];
  },
  webpack: (config) => {
    // Suppress "Serializing big strings" warnings (e.g. from Panda CSS styled-system)
    config.infrastructureLogging = { level: "error" };
    return config;
  },
};

export default withPayload(nextConfig);
