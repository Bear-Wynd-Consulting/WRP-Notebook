/**
 * Task-aware embedding wrapper.
 *
 * Vercel AI SDK's embed() doesn't have an EmbeddingTaskType abstraction.
 * This wrapper prepends task-specific prefixes to improve retrieval accuracy
 * by 5-15% (same technique as Nomic/Cohere task types).
 *
 * taskAwareEmbed / taskAwareEmbedMany — used by the Inngest pipeline (URL/text/YouTube)
 * generateEmbedding — used by the commit route (PDF two-phase flow)
 */
import { embed, embedMany } from "ai";
import { embeddingModel } from "./providers";
import { embedClient, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "./llm-client";

export type EmbeddingTask =
  | "retrieval_query"    // short search query
  | "retrieval_document" // document being indexed
  | "similarity"         // general similarity comparison
  | "classification"     // content classification
  | "clustering";        // document clustering

const TASK_PREFIXES: Record<EmbeddingTask, string> = {
  retrieval_query: "search_query: ",
  retrieval_document: "search_document: ",
  similarity: "",
  classification: "classify: ",
  clustering: "cluster: ",
};

export async function taskAwareEmbed(
  text: string,
  task: EmbeddingTask = "retrieval_document"
) {
  const prefix = TASK_PREFIXES[task];
  return embed({
    model: embeddingModel,
    value: `${prefix}${text}`,
  });
}

export async function taskAwareEmbedMany(
  texts: string[],
  task: EmbeddingTask = "retrieval_document"
) {
  const prefix = TASK_PREFIXES[task];
  return embedMany({
    model: embeddingModel,
    values: texts.map((t) => `${prefix}${t}`),
  });
}

/**
 * Direct embedding via the OpenAI-compatible client (works with LM Studio).
 * Used by the PDF commit route instead of the Vercel AI SDK path.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await embedClient.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    ...(EMBEDDING_MODEL.startsWith("text-embedding-3")
      ? { dimensions: EMBEDDING_DIMENSIONS }
      : {}),
  });
  return response.data[0].embedding;
}

// ─── Google models (if ever added) ───────────────────────────────────────────
// When using Google text-embedding-004, pass task natively:
//
//   import { google } from "@ai-sdk/google";
//   embed({
//     model: google.textEmbeddingModel("text-embedding-004"),
//     value: text,
//     providerOptions: { google: { taskType: "RETRIEVAL_QUERY" } },
//   });
