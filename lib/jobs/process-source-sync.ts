import { prisma } from "@/lib/db/client";
import { llmClient, LLM_MODEL } from "@/lib/ai/llm-client";
import { generateEmbedding } from "@/lib/ai/task-aware-embed";
import { AI_LIMITS, truncateSourceText } from "@/lib/ai/cost-guard";
import { sanitizeContent } from "@/lib/security/sanitize";

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

function extractFromText(content: string | null): string {
  return content ?? "";
}

async function extractFromUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "WRP-Notebook/1.0 (link-extractor)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const html = await res.text();
  return html
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
}

export async function processSourceSync(sourceId: string): Promise<void> {
  try {
    await prisma.source.update({
      where: { id: sourceId },
      data: { status: "PROCESSING" },
    });

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
      case "pdf":
        throw new Error("PDF sources use the two-phase editor flow");
      case "audio":
        throw new Error("Audio transcription is not yet implemented");
      default:
        throw new Error(`Unknown source type: ${source.type}`);
    }

    const extractedText = truncateSourceText(raw);

    if (!extractedText) {
      await prisma.source.update({
        where: { id: sourceId },
        data: { status: "ERROR" },
      });
      return;
    }

    const chunks = chunkText(extractedText);
    await prisma.sourceChunk.deleteMany({ where: { sourceId } });

    for (let i = 0; i < chunks.length; i++) {
      const text = chunks[i].slice(0, AI_LIMITS.MAX_EMBED_TEXT_LENGTH);
      const embedding = await generateEmbedding(text);
      await prisma.$executeRaw`
        INSERT INTO "SourceChunk" (id, "sourceId", content, embedding, "chunkIndex")
        VALUES (
          gen_random_uuid()::text,
          ${sourceId},
          ${chunks[i]},
          ${embedding}::vector,
          ${i}
        )
      `;
    }

    const preview = extractedText.slice(0, 10_000);
    const response = await llmClient.messages.create({
      model: LLM_MODEL,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Summarize the following document in 2-3 sentences:\n\n${preview}`,
        },
      ],
    });

    const summaryText = response.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join(" ");

    await prisma.source.update({
      where: { id: sourceId },
      data: {
        summary: sanitizeContent(summaryText),
        status: "READY",
      },
    });
  } catch (err) {
    await prisma.source
      .update({ where: { id: sourceId }, data: { status: "ERROR" } })
      .catch(() => {});
    throw err;
  }
}
