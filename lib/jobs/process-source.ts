/**
 * Inngest step function: source ingestion pipeline.
 *
 * Replaces the LangGraph workflow from the original open-notebook Python backend.
 * Each step is independently retryable and observable in the Inngest dashboard.
 *
 * ┌──────────┬──────────────────────────────────────────────────────────────┐
 * │ Type     │ How text is extracted                                        │
 * ├──────────┼──────────────────────────────────────────────────────────────┤
 * │ text     │ Source.content already holds the text — used as-is           │
 * │ url      │ URL from Source.metadata.url → fetch HTML → strip tags       │
 * │ youtube  │ URL from Source.metadata.url → fetch captions (YT API)       │
 * │ pdf      │ Source.blobUrl → download → pdf-parse → plain text           │
 * │ audio    │ Source.blobUrl → download → Whisper transcription            │
 * └──────────┴──────────────────────────────────────────────────────────────┘
 *
 * Steps 2–4 (chunk → embed → summarize) are shared across all types.
 */
import { inngest } from "./client";
import { prisma } from "@/lib/db/client";
import { taskAwareEmbedMany } from "@/lib/ai/task-aware-embed";
import { gatewayLlm } from "@/lib/ai/providers";
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
  return chunks.filter((c) => c.length > 50);
}

// ─── Type-specific text extractors ───────────────────────────────────────────

/** text: content is already stored on the source record. */
function extractFromText(content: string | null): string {
  return content ?? "";
}

/**
 * url / youtube: fetch the page or video and strip HTML/script/style tags.
 * For YouTube, the watch page contains the title and description which are
 * enough for basic retrieval; full transcript support requires the YT Data API.
 */
async function extractFromUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "WRP-Notebook/1.0 (link-extractor)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const html = await res.text();

  // Remove script, style, and nav elements, then strip remaining tags
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s{2,}/g, " ")
    .trim();

  return stripped;
}

/**
 * pdf: download from Vercel Blob URL and extract text with pdf-parse v2 (class API).
 */
async function extractFromPdf(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Could not download PDF: HTTP ${res.status}`);

  const arrayBuffer = await res.arrayBuffer();

  // Dynamic import so pdfjs-dist worker init only happens when needed
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: arrayBuffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

/**
 * audio: transcription is handled by a dedicated Whisper step.
 * Marked unsupported until the Whisper integration is wired up.
 */
function extractFromAudio(): never {
  throw new Error("Audio transcription is not yet implemented");
}

// ─── Job definition ───────────────────────────────────────────────────────────

export const processSource = inngest.createFunction(
  {
    id: "process-source",
    retries: 3,
    concurrency: { limit: 5 },
    triggers: [{ event: "source/uploaded" }],
  },
  async ({ event, step }) => {
    const { sourceId } = (event.data as { sourceId: string });

    await step.run("mark-processing", async () => {
      await prisma.source.update({
        where: { id: sourceId },
        data: { status: "PROCESSING" },
      });
    });

    // Step 1: Extract text — strategy depends on source type
    const extractedText = await step.run("extract-text", async () => {
      const source = await prisma.source.findUnique({ where: { id: sourceId } });
      if (!source) throw new Error(`Source ${sourceId} not found`);

      let raw = "";

      switch (source.type) {
        case "text":
          raw = extractFromText(source.content);
          break;

        case "url":
        case "youtube": {
          const meta = source.metadata as Record<string, string> | null;
          const url = meta?.url;
          if (!url) throw new Error(`No URL stored in metadata for source ${sourceId}`);
          raw = await extractFromUrl(url);
          break;
        }

        case "pdf": {
          if (!source.blobUrl) throw new Error(`No blobUrl for PDF source ${sourceId}`);
          raw = await extractFromPdf(source.blobUrl);
          break;
        }

        case "audio":
          extractFromAudio();
          break;

        default:
          throw new Error(`Unknown source type: ${source.type}`);
      }

      return truncateSourceText(raw);
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
        model: gatewayLlm,
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
