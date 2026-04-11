/**
 * POST /api/v1/search — cross-notebook search across all notebooks visible to the API key
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-middleware";
import { handleApiError } from "@/lib/api/error-response";
import { searchSchema } from "@/lib/validation/schemas";
import { taskAwareEmbed } from "@/lib/ai/task-aware-embed";
import { hybridSearchInNotebook, VectorSearchResult } from "@/lib/db/vector-search";
import { getNotebooksForApiKey } from "@/lib/db/scoped-queries";

interface EnrichedResult extends VectorSearchResult {
  notebookId: string;
  notebookName: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiCtx = await authenticateApiKey(req);

    const body = await req.json();
    const { query, limit, offset } = searchSchema.parse(body);

    // Get all notebooks visible to this key
    const notebooks = await getNotebooksForApiKey(apiCtx);
    const { embedding } = await taskAwareEmbed(query, "retrieval_query");

    // Search each notebook and merge results
    const allResults: EnrichedResult[] = (
      await Promise.all(
        notebooks.map((nb) =>
          hybridSearchInNotebook(nb.id, query, embedding, limit).then(
            (results) =>
              results.map((r) => ({
                ...r,
                notebookId: nb.id,
                notebookName: nb.name,
              }))
          )
        )
      )
    )
      .flat()
      .sort((a, b) => b.similarity - a.similarity);

    const page = allResults.slice(offset, offset + limit);

    return Response.json({
      data: page.map((r) => ({
        chunkId: r.id,
        sourceId: r.sourceId,
        notebookId: r.notebookId,
        notebookName: r.notebookName,
        content: r.content,
        similarity: r.similarity,
      })),
      meta: { total: allResults.length, limit, offset },
    });
  } catch (err) {
    return handleApiError(err, "POST /api/v1/search");
  }
}
