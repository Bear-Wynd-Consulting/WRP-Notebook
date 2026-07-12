/**
 * Chat pipeline: context retrieval → safe prompt → streamText → store message.
 *
 * Used by both the UI (streaming) and the public API (buffered response).
 */
import { streamText, generateText } from "ai";
import { prisma } from "@/lib/db/client";
import { primaryLlm } from "./providers";
import { taskAwareEmbed } from "./task-aware-embed";
import { buildSafePrompt, ContextChunk } from "./safe-prompt";
import { AI_LIMITS, truncateHistory } from "./cost-guard";
import { hybridSearchInNotebook } from "@/lib/db/vector-search";
import { sanitizeContent } from "@/lib/security/sanitize";
import { fetchPropertyContext } from "@/lib/db/property-queries";

// ─── Context Retrieval ────────────────────────────────────────────────────────

async function retrieveContext(
  notebookId: string,
  question: string,
  maxChunks: number = AI_LIMITS.MAX_CONTEXT_CHUNKS
): Promise<ContextChunk[]> {
  const [{ embedding }, notebook] = await Promise.all([
    taskAwareEmbed(question, "retrieval_query"),
    prisma.notebook.findUnique({ where: { id: notebookId }, select: { databases: true } }),
  ]);

  const [vectorChunks, propertyChunks] = await Promise.all([
    hybridSearchInNotebook(notebookId, question, embedding, maxChunks).then((results) =>
      results.map((r) => ({ id: r.id, sourceId: r.sourceId, content: r.content }))
    ),
    fetchPropertyContext(notebook?.databases ?? []),
  ]);

  return [...vectorChunks, ...propertyChunks];
}

// ─── Streaming chat (for UI useChat() hook) ───────────────────────────────────

/**
 * Stream a chat response for the UI.
 * Returns a StreamingTextResponse compatible with Vercel AI SDK's useChat().
 */
export async function streamChatResponse(opts: {
  notebookId: string;
  sessionId: string;
  userMessage: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const chunks = await retrieveContext(opts.notebookId, opts.userMessage);
  const systemMessages = buildSafePrompt(chunks, opts.userMessage);
  const truncatedHistory = truncateHistory(opts.history);

  return streamText({
    model: primaryLlm,
    maxOutputTokens: AI_LIMITS.MAX_OUTPUT_TOKENS,
    messages: [
      { role: "system", content: systemMessages[0].content },
      ...truncatedHistory,
      { role: "user", content: opts.userMessage },
    ],
    onFinish: async ({ text }) => {
      await storeChatMessage({
        sessionId: opts.sessionId,
        role: "assistant",
        content: text,
      });
    },
  });
}

// ─── Buffered ask (for /api/v1/notebooks/:id/ask) ────────────────────────────

export interface AskResult {
  answer: string;
  citations: Array<{ chunkId: string; sourceId: string; snippet: string }>;
}

/**
 * One-shot Q&A — retrieves context, generates a complete answer, returns it.
 */
export async function askNotebook(opts: {
  notebookId: string;
  question: string;
  maxSources?: number;
}): Promise<AskResult> {
  const chunks = await retrieveContext(
    opts.notebookId,
    opts.question,
    opts.maxSources ?? 5
  );

  const messages = buildSafePrompt(chunks, opts.question);

  const { text } = await generateText({
    model: primaryLlm,
    maxOutputTokens: AI_LIMITS.MAX_OUTPUT_TOKENS,
    messages,
  });

  const sanitizedAnswer = sanitizeContent(text);

  const citations = chunks.map((c) => ({
    chunkId: c.id,
    sourceId: c.sourceId,
    snippet: c.content.slice(0, 200),
  }));

  return { answer: sanitizedAnswer, citations };
}

// ─── Store chat message ───────────────────────────────────────────────────────

export async function storeChatMessage(opts: {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  citations?: AskResult["citations"];
}) {
  return prisma.chatMessage.create({
    data: {
      chatSessionId: opts.sessionId,
      role: opts.role,
      content: sanitizeContent(opts.content),
      citations: opts.citations ? opts.citations : undefined,
    },
  });
}
