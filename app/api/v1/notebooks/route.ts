/**
 * GET /api/v1/notebooks  — list notebooks visible to this API key
 * POST /api/v1/notebooks — create a notebook (INTERNAL or ADMIN scope)
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-middleware";
import { handleApiError, apiError } from "@/lib/api/error-response";
import { toPublicNotebook } from "@/lib/api/response-filters";
import {
  getNotebooksForApiKey,
  createAuditLog,
} from "@/lib/db/scoped-queries";
import { createNotebookSchema, paginationSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/db/client";

export async function GET(req: NextRequest) {
  try {
    const ctx = await authenticateApiKey(req);
    const { searchParams } = req.nextUrl;
    const { limit, offset } = paginationSchema.parse({
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    });

    const notebooks = await getNotebooksForApiKey(ctx);
    const page = notebooks.slice(offset, offset + limit);

    return Response.json({
      data: page.map(toPublicNotebook),
      meta: { total: notebooks.length, limit, offset },
    });
  } catch (err) {
    return handleApiError(err, "GET /api/v1/notebooks");
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await authenticateApiKey(req);

    if (ctx.scope === "EXTERNAL") {
      return apiError("External API keys cannot create notebooks", "FORBIDDEN", 403);
    }

    const body = await req.json();
    const data = createNotebookSchema.parse(body);

    const notebook = await prisma.notebook.create({
      data: {
        name: data.name,
        description: data.description,
        visibility: data.visibility,
        ownerId: ctx.id, // API key acts as the owner for API-created notebooks
      },
    });

    await createAuditLog({
      action: "notebook.create",
      actorType: "api_key",
      actorId: ctx.id,
      resource: `notebook:${notebook.id}`,
      metadata: { name: data.name, visibility: data.visibility },
    });

    return Response.json({ data: toPublicNotebook(notebook) }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "POST /api/v1/notebooks");
  }
}
