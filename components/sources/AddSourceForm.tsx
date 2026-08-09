"use client";

import { useRef, useState, useTransition, lazy, Suspense } from "react";
import type { OutputData } from "@editorjs/editorjs";
import { addTextOrUrlSource } from "@/app/(dashboard)/notebooks/[id]/actions";
import type { ContractFields } from "@/lib/validation/contract-schema";

// Lazy-load the Editor.js component — it requires the DOM and must stay client-only
const StructuredEditor = lazy(() => import("./StructuredEditor"));

type Tab = "url" | "text" | "pdf";
type PdfPhase = "select" | "extracting" | "review" | "done";

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
  extract_failed: "AI extraction failed. Try again or use the Plain Text tab to paste the content manually.",
  commit_failed: "Failed to save document. Please try again.",
};

export function AddSourceForm({ notebookId, errorCode }: Props) {
  const [tab, setTab] = useState<Tab>("url");
  const [isPending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(
    errorCode ? (ERROR_MESSAGES[errorCode] ?? decodeURIComponent(errorCode)) : null
  );
  const [success, setSuccess] = useState(false);

  // PDF two-phase state
  const [pdfPhase, setPdfPhase] = useState<PdfPhase>("select");
  const [extractedData, setExtractedData] = useState<{
    structuredData: OutputData;
    rawText: string;
    isContract: boolean;
    contractFields: ContractFields | null;
    source: "text-layer" | "ocr";
  } | null>(null);

  const formRef = useRef<HTMLFormElement>(null);

  function resetPdfFlow() {
    setPdfPhase("select");
    setExtractedData(null);
    setLocalError(null);
    formRef.current?.reset();
  }

  function handleTabChange(t: Tab) {
    setTab(t);
    setLocalError(null);
    setSuccess(false);
    if (t !== "pdf") resetPdfFlow();
  }

  // ── PDF Phase 1: extract ───────────────────────────────────────────────────
  async function handlePdfExtract(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);

    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File | null;
    if (!file || file.size === 0) {
      setLocalError(ERROR_MESSAGES.no_file);
      return;
    }

    setPdfPhase("extracting");

    try {
      const res = await fetch("/api/v1/sources/extract", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Extraction failed");
      }

      const data = await res.json() as {
        structuredData: OutputData;
        rawText: string;
        isContract: boolean;
        contractFields: ContractFields | null;
        source: "text-layer" | "ocr";
      };
      setExtractedData(data);
      setPdfPhase("review");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : ERROR_MESSAGES.extract_failed);
      setPdfPhase("select");
    }
  }

  // ── URL / text submit (unchanged path) ────────────────────────────────────
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    setSuccess(false);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await addTextOrUrlSource(notebookId, fd);
        setSuccess(true);
        formRef.current?.reset();
      } catch {
        setLocalError("Something went wrong. Please try again.");
      }
    });
  }

  // ── Render: PDF review phase ───────────────────────────────────────────────
  if (tab === "pdf" && pdfPhase === "review" && extractedData) {
    return (
      <div
        className="rounded-xl border p-4"
        style={{ backgroundColor: "white", borderColor: "var(--wrp-accent)" }}
      >
        <p className="text-sm font-medium mb-4" style={{ color: "var(--wrp-primary)" }}>
          Review extracted content, add context, then confirm to ingest.
        </p>
        <Suspense fallback={<p className="text-sm text-gray-500">Loading editor…</p>}>
          <StructuredEditor
            initialData={extractedData.structuredData}
            rawText={extractedData.rawText}
            notebookId={notebookId}
            isContract={extractedData.isContract}
            contractFields={extractedData.contractFields}
            extractionSource={extractedData.source}
            onCommitSuccess={() => {
              setPdfPhase("done");
              setExtractedData(null);
              setSuccess(true);
              formRef.current?.reset();
            }}
            onCancel={resetPdfFlow}
          />
        </Suspense>
      </div>
    );
  }

  // ── Render: standard form ──────────────────────────────────────────────────
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
            onClick={() => handleTabChange(t)}
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
          {tab === "pdf" ? "Document ingested and ready." : "Source added — processing will begin shortly."}
        </p>
      )}

      {/* PDF tab uses its own form + handler */}
      {tab === "pdf" ? (
        <form ref={formRef} onSubmit={handlePdfExtract} className="space-y-3">
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
              PDF files only. The AI will extract and structure the content for you to review before saving.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--wrp-text)" }}>
            <input name="isContract" type="checkbox" value="true" />
            This is a lease/contract document — extract tenant, rent, and lease dates
          </label>
          <button
            type="submit"
            disabled={pdfPhase === "extracting"}
            className="px-4 py-2 text-white text-sm font-medium rounded-md transition-opacity"
            style={{
              backgroundColor: "var(--wrp-primary)",
              opacity: pdfPhase === "extracting" ? 0.6 : 1,
            }}
          >
            {pdfPhase === "extracting" ? "Extracting…" : "Extract & Review"}
          </button>
        </form>
      ) : (
        /* URL and text tabs */
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
          <input type="hidden" name="type" value={tab === "text" ? "text" : "url"} />

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
      )}
    </div>
  );
}
