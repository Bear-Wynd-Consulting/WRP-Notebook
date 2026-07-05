/**
 * POST /api/notebooks/:id/chat
 *
 * Session-authenticated chat endpoint for the dashboard UI.
 * Uses NextAuth session (not API key) — mirrors the v1 chat route but
 * scoped to the logged-in user's own notebooks.
 *
 * The frontend (components/chat/ChatInterface.tsx) is a hand-rolled fetch()
 * + ReadableStream reader that consumes the plain-text body from
 * toTextStreamResponse() below — it does NOT use the Vercel AI SDK's
 * useChat() hook, so useChat()'s data-stream protocol does not apply here.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth-config";
import {
  getNotebookForUser,
  getChatMessagesForSession,
  createChatSession,
  getChatSessionById,
} from "@/lib/db/scoped-queries";
import { streamChatResponse, storeChatMessage } from "@/lib/ai/chat";
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

  let sessionId: string;
  let historyMessages: { role: "user" | "assistant"; content: string }[];
  try {
    const notebook = await getNotebookForUser(id, session.user.id);
    if (!notebook) {
      return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }

    // Get or create chat session
    const requestedSessionId =
      typeof body.sessionId === "string" ? body.sessionId : "";
    if (requestedSessionId) {
      // IDOR check — a client-supplied sessionId must belong to this notebook,
      // not just any notebook the user can see.
      const chatSession = await getChatSessionById(requestedSessionId);
      if (!chatSession || chatSession.notebookId !== id) {
        return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
      }
      sessionId = requestedSessionId;
    } else {
      const chatSession = await createChatSession(id, message.slice(0, 80));
      sessionId = chatSession.id;
    }

    // Load history
    const history = await getChatMessagesForSession(sessionId);
    historyMessages = history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Store user message
    await storeChatMessage({ sessionId, role: "user", content: message });
  } catch (err) {
    console.error("[chat] setup failed:", err);
    return NextResponse.json(
      { error: "Chat unavailable", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }

  // Stream response
  let result;
  try {
    result = await streamChatResponse({
      notebookId: id,
      sessionId,
      userMessage: message,
      history: historyMessages,
    });
  } catch (err) {
    console.error("[chat] streamChatResponse failed:", err);
    return NextResponse.json(
      { error: "Chat unavailable", code: "CHAT_ERROR" },
      { status: 500 }
    );
  }

  return result.toTextStreamResponse({
    headers: { "X-Session-Id": sessionId },
  });
}
