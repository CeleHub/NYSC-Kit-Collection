import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow connections from local network IPs (e.g. mobile phone testing)
  allowedDevOrigins: [
    "localhost:3000",
    "127.0.0.1:3000",
    "192.168.*.*",
    "192.168.101.132",
    "192.168.101.132:3000",
  ],
};

export default nextConfig;
