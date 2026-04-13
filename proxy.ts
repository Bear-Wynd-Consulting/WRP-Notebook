/**
 * Next.js proxy (formerly middleware) — runs on every matched request.
 *
 * Enforces:
 * - Request body size limits (1MB JSON, 50MB file uploads)
 * - CORS pre-flight handling for /api/v1/* (actual headers set in next.config.ts)
 */
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "https://tours.wrp.ca",
  "https://manage.wrp.ca",
  "https://www.wrp.ca",
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
];

const MAX_JSON_BODY = 1 * 1024 * 1024; // 1MB
const MAX_UPLOAD_BODY = 50 * 1024 * 1024; // 50MB

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ── CORS pre-flight for API routes ────────────────────────────────────────
  if (request.method === "OPTIONS" && pathname.startsWith("/api/v1/")) {
    const origin = request.headers.get("origin") ?? "";
    const isAllowed =
      ALLOWED_ORIGINS.includes(origin) ||
      process.env.NODE_ENV === "development";

    if (!isAllowed) {
      return new NextResponse(null, { status: 403 });
    }

    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // ── Request body size limits ───────────────────────────────────────────────
  if (pathname.startsWith("/api/v1/") && request.method !== "GET") {
    const contentLength = parseInt(
      request.headers.get("content-length") ?? "0"
    );

    const isUpload =
      pathname.includes("/sources") && request.method === "POST";
    const limit = isUpload ? MAX_UPLOAD_BODY : MAX_JSON_BODY;

    if (contentLength > limit) {
      return NextResponse.json(
        { error: "Request body too large", code: "PAYLOAD_TOO_LARGE" },
        { status: 413 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/v1/:path*"],
};
