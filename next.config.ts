import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdf-parse uses pdfjs-dist which tries to load a web worker when bundled.
  // Marking it external lets it run as a plain Node.js module instead.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  // @napi-rs/canvas is a transitive, dynamically-require()d dependency of
  // pdfjs-dist — serverExternalPackages alone doesn't get its files (or its
  // platform-specific native binary) copied into .next/standalone, since the
  // file tracer can't see a dynamic require. Force-include it explicitly, or
  // every PDF upload fails with "Cannot find module '@napi-rs/canvas'" /
  // ReferenceError: DOMMatrix is not defined.
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-linux-x64-musl/**/*",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
      // pdfjs-dist loads its worker script (pdf.worker.mjs) at runtime via a
      // path lookup the tracer also can't follow statically.
      "./node_modules/pdfjs-dist/**/*",
    ],
  },
};

export default nextConfig;
