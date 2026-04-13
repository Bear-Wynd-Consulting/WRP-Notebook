/**
 * POST /api/v1/notebooks/:id/chat
 *
 * Send a message to the notebook AI assistant. Returns a streaming response
 * compatible with the Vercel AI SDK useChat() hook.
 * Creates a new session if sessionId is not provided.
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-middleware";
import { authorizeNotebookAccess } from "@/lib/auth/authorize";
import { handleApiError } from "@/lib/api/error-response";
import { streamChatResponse, storeChatMessage } from "@/lib/ai/chat";
import { chatMessageSchema } from "@/lib/validation/schemas";
import { getChatMessagesForSession } from "@/lib/db/scoped-queries";
import { prisma } from "@/lib/db/client";
import type { RouteCtx } from '@/lib/types/route-context';

export async function POST(
  req: NextRequest,
  ctx: RouteCtx<{ id: string }>
) {
  try {
    const { id } = await ctx.params;
    const apiCtx = await authenticateApiKey(req);
    await authorizeNotebookAccess(id, apiCtx);

    const body = await req.json();
    const { message, sessionId } = chatMessageSchema.parse(body);

    // Get or create session
    let resolvedSessionId: string = sessionId ?? "";
    if (!sessionId) {
      const session = await prisma.chatSession.create({
        data: { notebookId: id, title: message.slice(0, 80) },
      });
      resolvedSessionId = session.id;
    }

    // Load history for context
    const history = await getChatMessagesForSession(resolvedSessionId);
    const historyMessages = history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Store user message
    await storeChatMessage({
      sessionId: resolvedSessionId,
      role: "user",
      content: message,
    });

    // Stream AI response
    const result = await streamChatResponse({
      notebookId: id,
      sessionId: resolvedSessionId,
      userMessage: message,
      history: historyMessages,
    });

    // Return streaming response (compatible with Vercel AI SDK useChat)
    return result.toTextStreamResponse({
      headers: {
        "X-Session-Id": resolvedSessionId ?? "",
      },
    });
  } catch (err) {
    return handleApiError(err, "POST /api/v1/notebooks/[id]/chat");
  }
}
