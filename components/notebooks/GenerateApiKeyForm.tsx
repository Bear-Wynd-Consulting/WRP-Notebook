"use client";

import { useState } from "react";

interface Props {
  notebookId: string;
}

export function GenerateApiKeyForm({ notebookId }: Props) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIssuedKey(null);

    const fd = new FormData(e.currentTarget);
    setIsPending(true);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          scope: fd.get("scope"),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to generate key");
        return;
      }
      setIssuedKey(body.data.key);
      e.currentTarget.reset();
    } catch {
      setError("Failed to generate key");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {issuedKey && (
        <div
          className="p-3 rounded-md text-sm space-y-1"
          style={{ backgroundColor: "var(--wrp-accent)", color: "var(--wrp-dark)" }}
        >
          <p className="font-medium">Copy this key now — it won&apos;t be shown again.</p>
          <code className="block break-all font-mono text-xs">{issuedKey}</code>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-md text-sm text-red-600" style={{ backgroundColor: "#fee2e2" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="key-name" className="block text-xs font-medium mb-1" style={{ color: "var(--wrp-text-muted)" }}>
            Key name
          </label>
          <input
            id="key-name"
            name="name"
            type="text"
            required
            maxLength={100}
            placeholder="e.g. Property Tour App"
            className="px-3 py-2 border rounded-md text-sm focus:outline-none"
            style={{ borderColor: "var(--wrp-secondary)" }}
          />
        </div>

        <div>
          <label htmlFor="key-scope" className="block text-xs font-medium mb-1" style={{ color: "var(--wrp-text-muted)" }}>
            Scope
          </label>
          <select
            id="key-scope"
            name="scope"
            defaultValue="EXTERNAL"
            className="px-3 py-2 border rounded-md text-sm focus:outline-none"
            style={{ borderColor: "var(--wrp-secondary)" }}
          >
            <option value="EXTERNAL">External — read-only</option>
            <option value="INTERNAL">Internal — full CRUD</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-white text-sm font-medium rounded-md transition-opacity"
          style={{ backgroundColor: "var(--wrp-primary)", opacity: isPending ? 0.6 : 1 }}
        >
          {isPending ? "Generating…" : "Generate Key"}
        </button>
      </form>
    </div>
  );
}
