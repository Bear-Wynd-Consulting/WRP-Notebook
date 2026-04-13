/**
 * POST /api/v1/notebooks/:id/search
 *
 * Hybrid semantic + full-text search within a single notebook.
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-middleware";
import { authorizeNotebookAccess } from "@/lib/auth/authorize";
import { handleApiError } from "@/lib/api/error-response";
import { searchSchema } from "@/lib/validation/schemas";
import { taskAwareEmbed } from "@/lib/ai/task-aware-embed";
import { hybridSearchInNotebook } from "@/lib/db/vector-search";
import type { RouteCtx } from '@/lib/types/route-context';

export async function POST(
  req: NextRequest,
  ctx: RouteCtx<{ id: string }>
) {
  try {
    const { id } = await ctx.params;
    const apiCtx = await authenticateApiKey(req);
    await authorizeNotebookAccess(id, apiCtx);

    const body = await req.json();
    const { query, limit, offset } = searchSchema.parse(body);

    const { embedding } = await taskAwareEmbed(query, "retrieval_query");
    const results = await hybridSearchInNotebook(id, query, embedding, limit + offset);
    const page = results.slice(offset, offset + limit);

    return Response.json({
      data: page.map((r) => ({
        chunkId: r.id,
        sourceId: r.sourceId,
        content: r.content,
        similarity: r.similarity,
      })),
      meta: { total: results.length, limit, offset },
    });
  } catch (err) {
    return handleApiError(err, "POST /api/v1/notebooks/[id]/search");
  }
}
