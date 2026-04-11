/**
 * GET /api/v1/health — health check (ADMIN scope only)
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-middleware";
import { handleApiError, apiError } from "@/lib/api/error-response";
import { prisma } from "@/lib/db/client";

export async function GET(req: NextRequest) {
  try {
    const apiCtx = await authenticateApiKey(req);

    if (apiCtx.scope !== "ADMIN") {
      return apiError("Admin access required", "FORBIDDEN", 403);
    }

    // Quick database connectivity check
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      data: {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version ?? "unknown",
      },
    });
  } catch (err) {
    return handleApiError(err, "GET /api/v1/health");
  }
}
