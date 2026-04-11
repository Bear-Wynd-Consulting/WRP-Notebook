/**
 * Inngest step function: source ingestion pipeline.
 *
 * Replaces the LangGraph workflow from the original open-notebook Python backend.
 * Each step is independently retryable and observable in the Inngest dashboard.
 *
 * Steps:
 *  1. extract-text     — fetch/parse content from the source
 *  2. chunk-text       — split into overlapping chunks
 *  3. embed-chunks     — generate embeddings via OpenAI
 *  4. summarize        — generate a short summary via Claude
 */
import { inngest } from "./client";
import { prisma } from "@/lib/db/client";
import { taskAwareEmbedMany } from "@/lib/ai/task-aware-embed";
import { fastLlm } from "@/lib/ai/providers";
import { generateText } from "ai";
import { AI_LIMITS, batchForEmbedding, truncateSourceText } from "@/lib/ai/cost-guard";
import { sanitizeContent } from "@/lib/security/sanitize";

// ─── Text chunking ────────────────────────────────────────────────────────────

function chunkText(text: string, maxChars = 2000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
    if (start >= text.length) break;
  }
  return chunks.filter((c) => c.length > 50); // drop tiny trailing chunks
}

// ─── Job definition ───────────────────────────────────────────────────────────

export const processSource = inngest.createFunction(
  {
    id: "process-source",
    retries: 3,
    concurrency: { limit: 5 }, // max 5 concurrent source processing jobs
    triggers: [{ event: "source/uploaded" }],
  },
  async ({ event, step }: { event: { data: { sourceId: string } }; step: { run: <T>(id: string, fn: () => Promise<T>) => Promise<T> } }) => {
    const { sourceId } = event.data;

    // Mark as processing
    await step.run("mark-processing", async () => {
      await prisma.source.update({
        where: { id: sourceId },
        data: { status: "PROCESSING" },
      });
    });

    // Step 1: Extract text
    const extractedText = await step.run("extract-text", async () => {
      const source = await prisma.source.findUnique({ where: { id: sourceId } });
      if (!source) throw new Error(`Source ${sourceId} not found`);

      // For text/url sources, content is already populated by the upload handler.
      // For PDF/audio, a specialised extractor would run here.
      const text = source.content ?? "";
      return truncateSourceText(text);
    });

    if (!extractedText) {
      await prisma.source.update({
        where: { id: sourceId },
        data: { status: "ERROR" },
      });
      return { status: "error", reason: "no_text_extracted" };
    }

    // Step 2: Chunk text
    const chunks = await step.run("chunk-text", async () => {
      return chunkText(extractedText);
    });

    // Step 3: Embed chunks (in batches to respect cost guard)
    await step.run("embed-chunks", async () => {
      // Remove old chunks first (re-processing scenario)
      await prisma.sourceChunk.deleteMany({ where: { sourceId } });

      const batches = batchForEmbedding(chunks);
      let chunkIndex = 0;

      for (const batch of batches) {
        const batchTexts = batch.map((c) =>
          c.slice(0, AI_LIMITS.MAX_EMBED_TEXT_LENGTH)
        );
        const { embeddings } = await taskAwareEmbedMany(
          batchTexts,
          "retrieval_document"
        );

        // Store chunks with their embeddings using raw SQL (Prisma doesn't support vector natively)
        for (let i = 0; i < batch.length; i++) {
          await prisma.$executeRaw`
            INSERT INTO "SourceChunk" (id, "sourceId", content, embedding, "chunkIndex")
            VALUES (
              gen_random_uuid()::text,
              ${sourceId},
              ${batch[i]},
              ${embeddings[i]}::vector,
              ${chunkIndex + i}
            )
          `;
        }
        chunkIndex += batch.length;
      }

      return { chunksStored: chunks.length };
    });

    // Step 4: Generate summary
    await step.run("summarize", async () => {
      const preview = extractedText.slice(0, 10_000);
      const { text } = await generateText({
        model: fastLlm,
        maxOutputTokens: 500,
        messages: [
          {
            role: "user",
            content: `Summarize the following document in 2-3 sentences:\n\n${preview}`,
          },
        ],
      });

      await prisma.source.update({
        where: { id: sourceId },
        data: {
          summary: sanitizeContent(text),
          status: "READY",
        },
      });
    });

    return { status: "ready", chunks: chunks.length };
  }
);
