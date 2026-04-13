/**
 * Vercel AI SDK provider configuration.
 *
 * Anthropic Claude is the primary LLM (best reasoning, WRP-familiar).
 * OpenAI is used for embeddings (text-embedding-3-small) and as an LLM fallback.
 */
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

// ─── LLM Models ───────────────────────────────────────────────────────────────

/** Primary LLM for chat, ask, and transformations */
export const primaryLlm = anthropic("claude-sonnet-4-5");

/** Fallback LLM (used if Anthropic is unavailable) */
export const fallbackLlm = openai("gpt-4o-mini");

/** Fast model for lightweight tasks (summarisation, insight extraction) */
export const fastLlm = anthropic("claude-haiku-4-5-20251001");

// ─── Embedding Models ─────────────────────────────────────────────────────────

/** OpenAI text-embedding-3-small — 1536 dimensions, cost-effective */
export const embeddingModel = openai.embedding("text-embedding-3-small");

// ─── Constants ────────────────────────────────────────────────────────────────

/** Must match the vector(N) dimension in schema.prisma */
export const EMBEDDING_DIMENSIONS = 1536;
