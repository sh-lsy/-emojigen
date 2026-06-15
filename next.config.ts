import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Next.js blocks cross-origin requests to dev resources by default for safety.
  // The dev server is bound to localhost, but when accessed from another device
  // on the same network (LAN IP like 192.168.56.1), you need to whitelist
  // those hostnames. NOTE: only exact hostnames or `*.example.com` wildcards
  // are supported — CIDR ranges are NOT.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.56.1",
    "*.192.168.56.1",
    "10.0.0.1",
    "*.10.0.0.1",
    "192.168.1.1",
    "*.192.168.1.1",
  ],
};

export default nextConfig;
