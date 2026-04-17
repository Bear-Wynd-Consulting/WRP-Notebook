"use client";

import { useRef, useState, useTransition } from "react";
import { addTextOrUrlSource, addFileSource } from "@/app/(dashboard)/notebooks/[id]/actions";

type Tab = "url" | "text" | "pdf";

const TAB_LABELS: Record<Tab, string> = {
  url: "URL / YouTube",
  text: "Plain Text",
  pdf: "PDF / File",
};

interface Props {
  notebookId: string;
  /** URL error code from searchParams — shown on mount */
  errorCode?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Please check your input and try again.",
  url: "That URL could not be validated. Make sure it is publicly reachable.",
  no_file: "Please select a file.",
  too_large: "File must be 10 MB or smaller.",
  upload_failed: "File upload failed. Check that Vercel Blob storage is configured (BLOB_READ_WRITE_TOKEN).",
  storage_not_configured: "File storage is not configured. Add BLOB_READ_WRITE_TOKEN to your environment variables.",
};

export function AddSourceForm({ notebookId, errorCode }: Props) {
  const [tab, setTab] = useState<Tab>("url");
  const [isPending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(
    errorCode
      ? (ERROR_MESSAGES[errorCode] ?? decodeURIComponent(errorCode))
      : null
  );
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    setSuccess(false);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        if (tab === "pdf") {
          await addFileSource(notebookId, fd);
        } else {
          await addTextOrUrlSource(notebookId, fd);
        }
        setSuccess(true);
        formRef.current?.reset();
      } catch {
        setLocalError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div
      className="rounded-xl border p-4"
      style={{ backgroundColor: "white", borderColor: "var(--wrp-accent)" }}
    >
      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b" style={{ borderColor: "var(--wrp-accent)" }}>
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setLocalError(null); setSuccess(false); }}
            className="px-3 py-2 text-sm font-medium transition-colors"
            style={{
              color: tab === t ? "var(--wrp-primary)" : "var(--wrp-text-muted)",
              borderBottom: tab === t ? "2px solid var(--wrp-primary)" : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {localError && (
        <p className="mb-3 text-sm px-3 py-2 rounded" style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}>
          {localError}
        </p>
      )}
      {success && (
        <p className="mb-3 text-sm px-3 py-2 rounded" style={{ backgroundColor: "#D1FAE5", color: "#065F46" }}>
          Source added — processing will begin shortly.
        </p>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
        {/* Hidden type field */}
        <input type="hidden" name="type" value={tab === "pdf" ? "pdf" : tab === "text" ? "text" : "url"} />

        {tab === "url" && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--wrp-text)" }}>
                URL <span className="text-red-500">*</span>
              </label>
              <input
                name="url"
                type="url"
                required
                maxLength={2048}
                placeholder="https://example.com/article"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none"
                style={{ borderColor: "var(--wrp-secondary)" }}
              />
              <p className="mt-1 text-xs" style={{ color: "var(--wrp-text-muted)" }}>
                Paste a web page or YouTube video URL. Private/internal addresses are blocked.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--wrp-text)" }}>
                Title (optional)
              </label>
              <input
                name="title"
                type="text"
                maxLength={500}
                placeholder="Leave blank to use page title"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none"
                style={{ borderColor: "var(--wrp-secondary)" }}
              />
            </div>
          </>
        )}

        {tab === "text" && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--wrp-text)" }}>
                Title (optional)
              </label>
              <input
                name="title"
                type="text"
                maxLength={500}
                placeholder="e.g. Meeting notes — April 2026"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none"
                style={{ borderColor: "var(--wrp-secondary)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--wrp-text)" }}>
                Content <span className="text-red-500">*</span>
              </label>
              <textarea
                name="text"
                required
                rows={6}
                maxLength={500_000}
                placeholder="Paste or type your content here…"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none resize-y"
                style={{ borderColor: "var(--wrp-secondary)" }}
              />
            </div>
          </>
        )}

        {tab === "pdf" && (
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--wrp-text)" }}>
              File <span className="text-red-500">*</span>
            </label>
            <input
              name="file"
              type="file"
              required
              accept=".pdf"
              className="w-full text-sm"
              style={{ color: "var(--wrp-text)" }}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--wrp-text-muted)" }}>
              PDF files only — max 10 MB. For text content use the Plain Text tab.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-white text-sm font-medium rounded-md transition-opacity"
          style={{
            backgroundColor: "var(--wrp-primary)",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Adding…" : "Add Source"}
        </button>
      </form>
    </div>
  );
}
