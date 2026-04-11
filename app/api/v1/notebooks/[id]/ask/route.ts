/**
 * POST /api/v1/notebooks/:id/ask
 *
 * One-shot Q&A: retrieves context from the notebook, generates an AI answer,
 * returns the answer with source citations. Does not persist conversation history.
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-middleware";
import { authorizeNotebookAccess } from "@/lib/auth/authorize";
import { handleApiError } from "@/lib/api/error-response";
import { askNotebook } from "@/lib/ai/chat";
import { askSchema } from "@/lib/validation/schemas";
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
    const { question, maxSources } = askSchema.parse(body);

    const result = await askNotebook({
      notebookId: id,
      question,
      maxSources,
    });

    return Response.json({ data: result });
  } catch (err) {
    return handleApiError(err, "POST /api/v1/notebooks/[id]/ask");
  }
}
