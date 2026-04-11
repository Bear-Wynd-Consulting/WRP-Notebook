/**
 * GET   /api/v1/notebooks/:id  — get a notebook
 * PATCH /api/v1/notebooks/:id  — update a notebook
 * DELETE /api/v1/notebooks/:id — soft-delete a notebook
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-middleware";
import { authorizeNotebookAccess } from "@/lib/auth/authorize";
import { handleApiError, apiError } from "@/lib/api/error-response";
import { toPublicNotebook } from "@/lib/api/response-filters";
import { createAuditLog } from "@/lib/db/scoped-queries";
import { updateNotebookSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/db/client";
import type { RouteCtx } from "@/lib/types/route-context";

export async function GET(
  req: NextRequest,
  ctx: RouteCtx<{ id: string }>
) {
  try {
    const { id } = await ctx.params;
    const apiCtx = await authenticateApiKey(req);
    const notebook = await authorizeNotebookAccess(id, apiCtx);
    return Response.json({ data: toPublicNotebook(notebook) });
  } catch (err) {
    return handleApiError(err, "GET /api/v1/notebooks/[id]");
  }
}

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

    await authorizeNotebookAccess(id, apiCtx);

    const body = await req.json();
    const data = updateNotebookSchema.parse(body);

    const updated = await prisma.notebook.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.visibility !== undefined && { visibility: data.visibility }),
      },
    });

    await createAuditLog({
      action: "notebook.update",
      actorType: "api_key",
      actorId: apiCtx.id,
      resource: `notebook:${id}`,
      metadata: data,
    });

    return Response.json({ data: toPublicNotebook(updated) });
  } catch (err) {
    return handleApiError(err, "PATCH /api/v1/notebooks/[id]");
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: RouteCtx<{ id: string }>
) {
  try {
    const { id } = await ctx.params;
    const apiCtx = await authenticateApiKey(req);

    if (apiCtx.scope !== "ADMIN") {
      return apiError("Only ADMIN scope can delete notebooks", "FORBIDDEN", 403);
    }

    await authorizeNotebookAccess(id, apiCtx);

    // Soft delete — never hard delete
    await prisma.notebook.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await createAuditLog({
      action: "notebook.delete",
      actorType: "api_key",
      actorId: apiCtx.id,
      resource: `notebook:${id}`,
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err, "DELETE /api/v1/notebooks/[id]");
  }
}
