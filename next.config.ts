import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This is the critical line for Docker deployment
  output: "standalone",
  
  // Keep the rest of your existing configuration below...
  experimental: {
    // any existing experimental flags
  }
};

export default nextConfig;
