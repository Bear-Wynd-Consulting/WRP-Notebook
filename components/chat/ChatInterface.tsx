"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Props {
  notebookId: string;
}

export function ChatInterface({ notebookId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || isLoading) return;

      setInput("");
      setError(null);

      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);
      setIsLoading(true);

      try {
        const res = await fetch(`/api/notebooks/${notebookId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, sessionId: sessionId ?? undefined }),
        });

        if (!res.ok) {
          throw new Error(`Server error ${res.status}`);
        }

        // Capture session ID from response header
        const newSessionId = res.headers.get("X-Session-Id");
        if (newSessionId) setSessionId(newSessionId);

        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m
            )
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        // Remove the empty assistant placeholder
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, notebookId, sessionId]
  );

  return (
    <div
      className="rounded-xl border flex flex-col"
      style={{
        borderColor: "var(--wrp-accent)",
        backgroundColor: "white",
        height: "480px",
      }}
    >
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p
            className="text-sm text-center mt-8"
            style={{ color: "var(--wrp-text-muted)" }}
          >
            Ask a question about the sources or WRP property data in this notebook.
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className="max-w-[80%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap"
              style={
                msg.role === "user"
                  ? { backgroundColor: "var(--wrp-primary)", color: "white" }
                  : {
                      backgroundColor: "var(--wrp-surface)",
                      color: "var(--wrp-text)",
                      border: "1px solid var(--wrp-accent)",
                    }
              }
            >
              {msg.content || (
                <span style={{ color: "var(--wrp-text-muted)" }}>Thinking…</span>
              )}
            </div>
          </div>
        ))}

        {error && (
          <p
            className="text-xs px-3 py-2 rounded"
            style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}
          >
            {error}
          </p>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={sendMessage}
        className="flex gap-2 p-3 border-t"
        style={{ borderColor: "var(--wrp-accent)" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          placeholder="Ask a question…"
          className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none"
          style={{ borderColor: "var(--wrp-secondary)" }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-4 py-2 text-white text-sm font-medium rounded-md transition-opacity"
          style={{
            backgroundColor: "var(--wrp-primary)",
            opacity: isLoading || !input.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
