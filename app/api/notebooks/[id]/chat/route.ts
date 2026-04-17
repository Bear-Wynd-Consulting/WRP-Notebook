/**
 * POST /api/notebooks/:id/chat
 *
 * Session-authenticated chat endpoint for the dashboard UI.
 * Uses NextAuth session (not API key) — mirrors the v1 chat route but
 * scoped to the logged-in user's own notebooks.
 *
 * Compatible with Vercel AI SDK useChat() hook.
 */
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth-config";
import { getNotebookForUser, getChatMessagesForSession } from "@/lib/db/scoped-queries";
import { streamChatResponse, storeChatMessage } from "@/lib/ai/chat";
import { prisma } from "@/lib/db/client";
import type { RouteCtx } from "@/lib/types/route-context";

export async function POST(req: NextRequest, ctx: RouteCtx<{ id: string }>) {
  const { id } = await ctx.params;

  const session = await auth();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const notebook = await getNotebookForUser(id, session.user.id);
  if (!notebook) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { message?: string; sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get or create chat session
  let sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!sessionId) {
    const chatSession = await prisma.chatSession.create({
      data: { notebookId: id, title: message.slice(0, 80) },
    });
    sessionId = chatSession.id;
  }

  // Load history
  const history = await getChatMessagesForSession(sessionId);
  const historyMessages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  // Store user message
  await storeChatMessage({ sessionId, role: "user", content: message });

  // Stream response
  const result = await streamChatResponse({
    notebookId: id,
    sessionId,
    userMessage: message,
    history: historyMessages,
  });

  return result.toTextStreamResponse({
    headers: { "X-Session-Id": sessionId },
  });
}
