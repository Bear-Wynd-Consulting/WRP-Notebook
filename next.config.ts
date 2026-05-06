import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdf-parse uses pdfjs-dist which tries to load a web worker when bundled.
  // Marking it external lets it run as a plain Node.js module instead.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
