/**
 * GET  /api/v1/notebooks/:id/notes — list notes in a notebook
 * POST /api/v1/notebooks/:id/notes — create a note in a notebook
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-middleware";
import { authorizeNotebookAccess } from "@/lib/auth/authorize";
import { handleApiError, apiError } from "@/lib/api/error-response";
import { toPublicNote } from "@/lib/api/response-filters";
import { getNotesForNotebook, createAuditLog } from "@/lib/db/scoped-queries";
import { createNoteSchema, paginationSchema } from "@/lib/validation/schemas";
import { sanitizeContent } from "@/lib/security/sanitize";
import { prisma } from "@/lib/db/client";
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

    const notes = await getNotesForNotebook(id);
    const page = notes.slice(offset, offset + limit);

    return Response.json({
      data: page.map(toPublicNote),
      meta: { total: notes.length, limit, offset },
    });
  } catch (err) {
    return handleApiError(err, "GET /api/v1/notebooks/[id]/notes");
  }
}

export async function POST(
  req: NextRequest,
  ctx: RouteCtx<{ id: string }>
) {
  try {
    const { id } = await ctx.params;
    const apiCtx = await authenticateApiKey(req);

    if (apiCtx.scope === "EXTERNAL") {
      return apiError("External API keys cannot create notes", "FORBIDDEN", 403);
    }

    await authorizeNotebookAccess(id, apiCtx);

    const body = await req.json();
    const data = createNoteSchema.parse(body);

    const note = await prisma.note.create({
      data: {
        title: data.title,
        content: sanitizeContent(data.content), // XSS prevention
        notebooks: {
          create: { notebookId: id },
        },
      },
    });

    await createAuditLog({
      action: "note.create",
      actorType: "api_key",
      actorId: apiCtx.id,
      resource: `note:${note.id}`,
      metadata: { notebookId: id },
    });

    return Response.json({ data: toPublicNote(note) }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "POST /api/v1/notebooks/[id]/notes");
  }
}
