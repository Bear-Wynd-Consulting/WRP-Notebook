/**
 * GET /api/v1/notebooks/:id/chat/sessions — list chat sessions for a notebook
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-middleware";
import { authorizeNotebookAccess } from "@/lib/auth/authorize";
import { handleApiError } from "@/lib/api/error-response";
import { toPublicChatSession } from "@/lib/api/response-filters";
import { getChatSessionsForNotebook } from "@/lib/db/scoped-queries";
import { paginationSchema } from "@/lib/validation/schemas";
import type { RouteCtx } from '@/lib/types/route-context';

export async function GET(
  req: NextRequest,
  ctx: RouteCtx<{ id: string }>
) {
  try {
    const { id } = await ctx.params;
    const apiCtx = await authenticateApiKey(req);
    await authorizeNotebookAccess(id, apiCtx);

    const { searchParams } = req.nextUrl;
    const { limit, offset } = paginationSchema.parse({
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    });

    const sessions = await getChatSessionsForNotebook(id);
    const page = sessions.slice(offset, offset + limit);

    return Response.json({
      data: page.map(toPublicChatSession),
      meta: { total: sessions.length, limit, offset },
    });
  } catch (err) {
    return handleApiError(err, "GET /api/v1/notebooks/[id]/chat/sessions");
  }
}
