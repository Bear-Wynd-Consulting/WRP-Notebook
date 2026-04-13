/**
 * GET /api/v1/admin/audit-log — paginated audit trail (ADMIN only)
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-middleware";
import { handleApiError, apiError } from "@/lib/api/error-response";
import { paginationSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/db/client";

export async function GET(req: NextRequest) {
  try {
    const apiCtx = await authenticateApiKey(req);

    if (apiCtx.scope !== "ADMIN") {
      return apiError("Admin access required", "FORBIDDEN", 403);
    }

    const { searchParams } = req.nextUrl;
    const { limit, offset } = paginationSchema.parse({
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    });

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.auditLog.count(),
    ]);

    return Response.json({
      data: entries,
      meta: { total, limit, offset },
    });
  } catch (err) {
    return handleApiError(err, "GET /api/v1/admin/audit-log");
  }
}
