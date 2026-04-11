/**
 * GET  /api/v1/notebooks/:id/sources — list sources in a notebook
 * POST /api/v1/notebooks/:id/sources — add a source (upload or URL ingest)
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-middleware";
import { authorizeNotebookAccess } from "@/lib/auth/authorize";
import { handleApiError, apiError } from "@/lib/api/error-response";
import { toPublicSource } from "@/lib/api/response-filters";
import { getSourcesForNotebook, createAuditLog } from "@/lib/db/scoped-queries";
import { createSourceSchema, paginationSchema } from "@/lib/validation/schemas";
import { validateIngestUrl } from "@/lib/security/url-validator";
import { validateUpload } from "@/lib/security/file-upload";
import { prisma } from "@/lib/db/client";
import { inngest } from "@/lib/jobs/client";
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

    const sources = await getSourcesForNotebook(id);
    const page = sources.slice(offset, offset + limit);

    return Response.json({
      data: page.map(toPublicSource),
      meta: { total: sources.length, limit, offset },
    });
  } catch (err) {
    return handleApiError(err, "GET /api/v1/notebooks/[id]/sources");
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
      return apiError("External API keys cannot add sources", "FORBIDDEN", 403);
    }

    await authorizeNotebookAccess(id, apiCtx);

    const contentType = req.headers.get("content-type") ?? "";
    let sourceData: {
      type: string;
      title?: string;
      content?: string;
      url?: string;
      fileSize?: number;
      mimeType?: string;
    };

    if (contentType.includes("multipart/form-data")) {
      // File upload
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const type = formData.get("type") as string | null;

      if (!file || !type) {
        return apiError("file and type fields are required", "VALIDATION_ERROR", 400);
      }

      // Security: validate by magic bytes, not Content-Type
      const { safeName, detectedMimeType } = await validateUpload(file, type);
      const arrayBuffer = await file.arrayBuffer();
      const content = Buffer.from(arrayBuffer).toString("utf8");

      sourceData = {
        type,
        title: safeName,
        content,
        fileSize: file.size,
        mimeType: detectedMimeType,
      };
    } else {
      // JSON body (URL, text, YouTube)
      const body = await req.json();
      const parsed = createSourceSchema.parse(body);

      if (parsed.type === "url" && parsed.url) {
        // Security: SSRF protection — validate before fetching
        await validateIngestUrl(parsed.url);
      }

      sourceData = {
        type: parsed.type,
        title: parsed.title,
        url: parsed.url,
        content: parsed.text,
      };
    }

    // Create source record
    const source = await prisma.source.create({
      data: {
        type: sourceData.type,
        title: sourceData.title,
        content: sourceData.content,
        fileSize: sourceData.fileSize,
        mimeType: sourceData.mimeType,
        uploadedBy: apiCtx.id,
        status: "PENDING",
        notebooks: {
          create: { notebookId: id },
        },
      },
    });

    // Trigger background processing
    await inngest.send({
      name: "source/uploaded",
      data: { sourceId: source.id },
    });

    await createAuditLog({
      action: "source.create",
      actorType: "api_key",
      actorId: apiCtx.id,
      resource: `source:${source.id}`,
      metadata: { notebookId: id, type: source.type },
    });

    return Response.json({ data: toPublicSource(source) }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "POST /api/v1/notebooks/[id]/sources");
  }
}
