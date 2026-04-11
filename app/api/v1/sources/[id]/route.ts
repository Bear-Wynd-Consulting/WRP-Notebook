/**
 * GET /api/v1/sources/:id — get a source by ID
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-middleware";
import { handleApiError } from "@/lib/api/error-response";
import { toPublicSource } from "@/lib/api/response-filters";
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

    return Response.json({ data: toPublicSource(source) });
  } catch (err) {
    return handleApiError(err, "GET /api/v1/sources/[id]");
  }
}
