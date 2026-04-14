import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LAN/mobile devices to access Next.js dev resources (HMR/runtime chunks).
  // Add your phone IP here if it changes.
  allowedDevOrigins: [
    "192.168.1.23",
    "192.168.3.1",
    "192.168.68.55",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
