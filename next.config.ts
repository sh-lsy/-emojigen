import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow dev access from LAN IPs (e.g. 192.168.x.x) so the app works
  // when opened from another device on the same network during development.
  allowedDevOrigins: ["192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12"],
};

export default nextConfig;
