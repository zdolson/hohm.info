import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  trailingSlash: false,
  async redirects() {
    return [{ source: "/admin/", destination: "/admin", permanent: true }];
  },
};

export default withPayload(nextConfig);
