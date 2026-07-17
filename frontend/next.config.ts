import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a standalone server bundle for Docker deployments.
  // See: https://nextjs.org/docs/app/api-reference/next-config-js/output
  output: 'standalone',
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
