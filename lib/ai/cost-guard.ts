/**
 * AI cost guards — prevent runaway token usage and control spend.
 *
 * Applied in every AI call: chat, ask, embed, summarise.
 */

export const AI_LIMITS = {
  /** Maximum output tokens per LLM request */
  MAX_OUTPUT_TOKENS: 4096,
  /** Maximum source chunks retrieved for context */
  MAX_CONTEXT_CHUNKS: 20,
  /** Maximum chat history messages before truncation */
  MAX_CHAT_HISTORY: 50,
  /** Maximum chunks per embedding batch */
  MAX_EMBEDDING_BATCH: 100,
  /** Maximum characters of source text to process (≈125k tokens) */
  MAX_SOURCE_TEXT_LENGTH: 500_000,
  /** Maximum text length for a single embed call */
  MAX_EMBED_TEXT_LENGTH: 8_000,
} as const;

export interface MessageLike {
  role: string;
  content: string;
}

/**
 * Truncate chat history to prevent context window abuse.
 * Keeps all system messages + the most recent N non-system messages.
 */
export function truncateHistory<T extends MessageLike>(
  messages: T[],
  maxMessages = AI_LIMITS.MAX_CHAT_HISTORY
): T[] {
  const system = messages.filter((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");
  if (nonSystem.length <= maxMessages) return messages;
  return [...system, ...nonSystem.slice(-maxMessages)];
}

/**
 * Truncate source text to the safe processing limit.
 */
export function truncateSourceText(text: string): string {
  if (text.length <= AI_LIMITS.MAX_SOURCE_TEXT_LENGTH) return text;
  return text.slice(0, AI_LIMITS.MAX_SOURCE_TEXT_LENGTH);
}

/**
 * Split an array into batches of at most MAX_EMBEDDING_BATCH items.
 */
export function batchForEmbedding<T>(items: T[]): T[][] {
  const size = AI_LIMITS.MAX_EMBEDDING_BATCH;
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}
