/**
 * Env-gated LLM and embedding clients.
 *
 * Both clients use the OpenAI-wire-protocol, which LM Studio also speaks.
 * Setting LLM_BASE_URL / EMBEDDING_BASE_URL routes traffic to the local
 * llmster container instead of the cloud APIs.
 *
 * Used by: extract route, commit route, task-aware-embed.ts
 * Not used by: Vercel AI SDK streamText/generateText flows (see providers.ts)
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const llmClient = new Anthropic({
  baseURL: process.env.LLM_BASE_URL ?? "https://api.anthropic.com",
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

export const LLM_MODEL =
  process.env.LLM_MODEL ?? "google/gemma-4-e2b";

export const embedClient = new OpenAI({
  baseURL: process.env.EMBEDDING_BASE_URL ?? "https://api.openai.com/v1",
  apiKey: process.env.EMBEDDING_API_KEY ?? "",
});

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? "google/embedding-gemma-300m";

export const EMBEDDING_DIMENSIONS = parseInt(
  process.env.EMBEDDING_DIMENSIONS ?? "768"
);
