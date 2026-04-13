/**
 * GET /api/v1/sources/:id/status — poll processing status
 *
 * Used by clients to poll until status reaches "ready" or "error".
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-middleware";
import { handleApiError } from "@/lib/api/error-response";
import { getSourceById } from "@/lib/db/scoped-queries";
import { NotFoundError } from "@/lib/auth/authorize";
import type { RouteCtx } from '@/lib/types/route-context';

export async function GET(
  req: NextRequest,
  ctx: RouteCtx<{ id: string }>
) {
  try {
    const { id } = await ctx.params;
    await authenticateApiKey(req);

    const source = await getSourceById(id);
    if (!source) throw new NotFoundError("Source not found");

    return Response.json({
      data: {
        id: source.id,
        status: source.status,
        updatedAt: source.updatedAt,
      },
    });
  } catch (err) {
    return handleApiError(err, "GET /api/v1/sources/[id]/status");
  }
}
