/**
 * PATCH  /api/v1/notes/:id — update a note
 * DELETE /api/v1/notes/:id — soft-delete a note
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-middleware";
import { handleApiError, apiError } from "@/lib/api/error-response";
import { toPublicNote } from "@/lib/api/response-filters";
import { getNoteById, createAuditLog } from "@/lib/db/scoped-queries";
import { updateNoteSchema } from "@/lib/validation/schemas";
import { sanitizeContent } from "@/lib/security/sanitize";
import { NotFoundError } from "@/lib/auth/authorize";
import { prisma } from "@/lib/db/client";
import type { RouteCtx } from '@/lib/types/route-context';

export async function PATCH(
  req: NextRequest,
  ctx: RouteCtx<{ id: string }>
) {
  try {
    const { id } = await ctx.params;
    const apiCtx = await authenticateApiKey(req);

    if (apiCtx.scope === "EXTERNAL") {
      return apiError("Insufficient permissions", "FORBIDDEN", 403);
    }

    const note = await getNoteById(id);
    if (!note) throw new NotFoundError("Note not found");

    const body = await req.json();
    const data = updateNoteSchema.parse(body);

    const updated = await prisma.note.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && {
          content: sanitizeContent(data.content),
        }),
      },
    });

    await createAuditLog({
      action: "note.update",
      actorType: "api_key",
      actorId: apiCtx.id,
      resource: `note:${id}`,
    });

    return Response.json({ data: toPublicNote(updated) });
  } catch (err) {
    return handleApiError(err, "PATCH /api/v1/notes/[id]");
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: RouteCtx<{ id: string }>
) {
  try {
    const { id } = await ctx.params;
    const apiCtx = await authenticateApiKey(req);

    if (apiCtx.scope === "EXTERNAL") {
      return apiError("Insufficient permissions", "FORBIDDEN", 403);
    }

    const note = await getNoteById(id);
    if (!note) throw new NotFoundError("Note not found");

    await prisma.note.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await createAuditLog({
      action: "note.delete",
      actorType: "api_key",
      actorId: apiCtx.id,
      resource: `note:${id}`,
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err, "DELETE /api/v1/notes/[id]");
  }
}
