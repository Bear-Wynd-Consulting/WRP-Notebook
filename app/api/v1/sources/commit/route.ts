/**
 * POST /api/v1/sources/commit
 *
 * Phase 2 of the two-phase PDF ingestion flow.
 * Accepts the user-confirmed Editor.js JSON + document metadata from the
 * StructuredEditor component, saves the source, chunks it by Editor.js block
 * (preserving natural document boundaries), embeds each chunk via the local
 * or cloud embedding client, and marks the source READY immediately.
 *
 * No Inngest job is triggered — the source is synchronously ready after this call.
 */
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth-config";
import { handleApiError, apiError } from "@/lib/api/error-response";
import {
  createStructuredSource,
  createAuditLog,
  getNotebookForUser,
} from "@/lib/db/scoped-queries";
import { prisma } from "@/lib/db/client";
import { commitSourceSchema } from "@/lib/validation/schemas";
import { generateEmbeddings } from "@/lib/ai/task-aware-embed";
import { AI_LIMITS } from "@/lib/ai/cost-guard";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("Authentication required", "UNAUTHORIZED", 401);
    }

    const body = await req.json();
    const { notebookId, metadata, structuredData, rawText } =
      commitSourceSchema.parse(body);

    // IDOR check — user must own the notebook
    const notebook = await getNotebookForUser(notebookId, session.user.id);
    if (!notebook) {
      return apiError("Notebook not found", "NOT_FOUND", 404);
    }

    const title =
      metadata.useCase?.trim() ||
      metadata.department?.trim() ||
      "Untitled Document";

    // Create source record in PROCESSING state (transaction with NotebookSource join)
    const source = await createStructuredSource({
      notebookId,
      title,
      metadata,
      structured: structuredData,
      rawText,
      uploadedBy: session.user.id,
    });

    // Chunk by Editor.js block — paragraph and header blocks only
    // This preserves natural document boundaries rather than arbitrary character windows
    const chunks: string[] = structuredData.blocks
      .filter(
        (block) => block.type === "paragraph" || block.type === "header"
      )
      .map((block) => {
        const text = (block.data as Record<string, unknown>).text;
        return typeof text === "string" ? text.trim() : "";
      })
      .filter((t) => t.length > 0);

    let chunksEmbedded = 0;

    // Prepare all chunks first
    const validChunks = chunks
      .map(chunk => chunk.slice(0, AI_LIMITS.MAX_EMBED_TEXT_LENGTH))
      .filter(chunk => chunk.trim().length > 0);

    const BATCH_SIZE = 50;
    for (let i = 0; i < validChunks.length; i += BATCH_SIZE) {
      const batch = validChunks.slice(i, i + BATCH_SIZE);

      // Generate embeddings for the batch
      const vectors = await generateEmbeddings(batch);

      // Insert the chunk records in parallel
      await Promise.all(
        batch.map(async (chunk, batchIdx) => {
          const globalIdx = i + batchIdx;
          const vectorArr = vectors[batchIdx];
          const vectorStr = `[${vectorArr.join(",")}]`;

          await prisma.$executeRaw`
            INSERT INTO notebook."SourceChunk" (id, "sourceId", content, embedding, "chunkIndex")
            VALUES (
              gen_random_uuid()::text,
              ${source.id},
              ${chunk},
              ${vectorStr}::vector,
              ${globalIdx}
            )
          `;
        })
      );
      chunksEmbedded += batch.length;
    }

    // Mark READY — no async job needed
    await prisma.source.update({
      where: { id: source.id },
      data: { status: "READY" },
    });

    await createAuditLog({
      action: "source.create",
      actorType: "user",
      actorId: session.user.id,
      resource: `source:${source.id}`,
      metadata: { notebookId, type: "pdf", chunksEmbedded },
    });

    return Response.json(
      { data: { sourceId: source.id, chunksEmbedded } },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err, "POST /api/v1/sources/commit");
  }
}
