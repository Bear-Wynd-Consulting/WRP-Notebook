/**
 * Vercel AI SDK provider configuration.
 *
 * When LLM_BASE_URL is set (local LM Studio), all AI traffic routes through
 * LM Studio's OpenAI-compatible endpoint (EMBEDDING_BASE_URL, which ends in /v1).
 * When LLM_BASE_URL is not set, Anthropic handles chat and OpenAI handles embeddings.
 */
import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

export const LLM_MODEL = process.env.LLM_MODEL ?? "google/gemma-4-e2b";

// OpenAI-compatible client — points at LM Studio when EMBEDDING_BASE_URL is set,
// otherwise falls back to api.openai.com/v1 for cloud deployments.
const openAICompat = createOpenAI({
  baseURL: process.env.EMBEDDING_BASE_URL ?? "https://api.openai.com/v1",
  apiKey: process.env.EMBEDDING_API_KEY ?? process.env.OPENAI_API_KEY ?? "sk-no-key",
});

/** Primary LLM for chat, ask, and transformations */
export const primaryLlm = process.env.LLM_BASE_URL
  ? openAICompat(LLM_MODEL)
  : anthropic(process.env.LLM_MODEL ?? "claude-sonnet-4-6");

/** Fast model for lightweight tasks */
export const fastLlm = process.env.LLM_BASE_URL
  ? openAICompat(LLM_MODEL)
  : anthropic(process.env.FAST_LLM_MODEL ?? "claude-haiku-4-5-20251001");

/** Fallback — always OpenAI-compat (local or cloud) */
export const fallbackLlm = openAICompat(LLM_MODEL);

/** Must match the vector(N) dimension in schema.prisma */
export const EMBEDDING_DIMENSIONS = parseInt(
  process.env.EMBEDDING_DIMENSIONS ?? "768"
);

/**
 * Embedding model via Vercel AI SDK.
 * Routes to LM Studio (EMBEDDING_BASE_URL) or OpenAI cloud depending on env.
 */
export const embeddingModel = openAICompat.embedding(
  process.env.EMBEDDING_MODEL ?? "text-embedding-3-small"
);
