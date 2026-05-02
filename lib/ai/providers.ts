/**
 * Vercel AI SDK provider configuration.
 *
 * Used for streaming chat and ask flows (streamText / generateText via AI SDK).
 * For the two-phase PDF extract/commit routes, use lib/ai/llm-client.ts instead,
 * which supports custom baseURL for LM Studio.
 */
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

// ─── LLM Models ───────────────────────────────────────────────────────────────

export const LLM_MODEL = process.env.LLM_MODEL ?? "gemma-4-2b-it";

/** Primary LLM for chat, ask, and transformations */
export const primaryLlm = anthropic(LLM_MODEL);

/** Fallback LLM (used if Anthropic is unavailable) */
export const fallbackLlm = openai("gpt-4o-mini");

/** Fast model for lightweight tasks (summarisation, insight extraction) */
export const fastLlm = anthropic(
  process.env.FAST_LLM_MODEL ?? "claude-haiku-4-5-20251001"
);

// ─── Embedding Models ─────────────────────────────────────────────────────────

/** Must match the vector(N) dimension in schema.prisma */
export const EMBEDDING_DIMENSIONS = parseInt(
  process.env.EMBEDDING_DIMENSIONS ?? "768"
);

/**
 * OpenAI-compatible embedding model via Vercel AI SDK.
 * text-embedding-3-small with dimensions=768 matches nomic-embed-text-v1.5 output width.
 */
export const embeddingModel = openai.embedding(
  process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  { dimensions: EMBEDDING_DIMENSIONS }
);
