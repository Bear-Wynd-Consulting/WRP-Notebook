/**
 * Env-gated embedding client.
 *
 * Uses the OpenAI-wire-protocol, which LM Studio also speaks — the same
 * protocol works for both real OpenAI (cloud) and llmster (local), so no
 * env-gated switching is needed here (unlike chat/generation — see providers.ts,
 * which switches between Anthropic and an OpenAI-compatible client because
 * those two DO speak different wire protocols).
 *
 * Used by: commit route, process-source-sync.ts (via task-aware-embed.ts)
 * Not used by: Vercel AI SDK streamText/generateText flows (see providers.ts)
 */
import OpenAI from "openai";

export const embedClient = new OpenAI({
  baseURL: process.env.EMBEDDING_BASE_URL ?? "https://api.openai.com/v1",
  apiKey: process.env.EMBEDDING_API_KEY ?? "",
});

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";

export const EMBEDDING_DIMENSIONS = parseInt(
  process.env.EMBEDDING_DIMENSIONS ?? "768"
);
