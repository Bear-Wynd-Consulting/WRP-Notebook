'use client';

import React, { useEffect, useRef, useState } from 'react';

// Editor.js types only — actual modules are dynamically imported to prevent SSR crash
import type EditorJS from '@editorjs/editorjs';
import type { OutputData } from '@editorjs/editorjs';

interface StructuredEditorProps {
  initialData: OutputData;
  rawText: string;
  notebookId: string;
  onCommitSuccess: () => void;
  onCancel: () => void;
}

interface Metadata {
  department: string;
  useCase: string;
  date: string;
}

export default function StructuredEditor({
  initialData,
  rawText,
  notebookId,
  onCommitSuccess,
  onCancel,
}: StructuredEditorProps) {
  const editorRef = useRef<EditorJS | null>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const [metadata, setMetadata] = useState<Metadata>({ department: '', useCase: '', date: '' });
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!holderRef.current || editorRef.current) return;

    let editor: EditorJS;

    // Dynamic import keeps Editor.js out of the SSR bundle (it requires window)
    Promise.all([
      import('@editorjs/editorjs'),
      import('@editorjs/header'),
      import('@editorjs/paragraph'),
      import('@editorjs/list'),
    ]).then(([{ default: EditorJSClass }, { default: Header }, { default: Paragraph }, { default: List }]) => {
      editor = new EditorJSClass({
        holder: holderRef.current!,
        tools: {
          header: { class: Header as never, inlineToolbar: true },
          paragraph: { class: Paragraph as never, inlineToolbar: true },
          list: { class: List as never, inlineToolbar: true },
        },
        data: initialData,
        placeholder: 'Edit the extracted content before committing…',
      });
      editorRef.current = editor;
    });

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy?.();
        editorRef.current = null;
      }
    };
    // initialData is stable after extraction — intentionally not in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCommit = async () => {
    if (!editorRef.current) return;
    setIsCommitting(true);
    setError(null);

    try {
      const finalData = await editorRef.current.save();

      const res = await fetch('/api/v1/sources/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebookId, metadata, structuredData: finalData, rawText }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? 'Commit failed');
      }

      onCommitSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit document. Please try again.');
    } finally {
      setIsCommitting(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2';
  const inputStyle = {
    borderColor: 'var(--wrp-secondary)',
    color: 'var(--wrp-text)',
  };

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Context metadata */}
      <div
        className="grid grid-cols-3 gap-3 p-4 rounded-lg border"
        style={{ backgroundColor: 'var(--wrp-surface)', borderColor: 'var(--wrp-accent)' }}
      >
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--wrp-text)' }}>
            Department
          </label>
          <input
            className={inputClass}
            style={inputStyle}
            placeholder="e.g. Research, Finance"
            value={metadata.department}
            onChange={(e) => setMetadata((m) => ({ ...m, department: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--wrp-text)' }}>
            Use Case
          </label>
          <input
            className={inputClass}
            style={inputStyle}
            placeholder="e.g. Lease Agreement"
            value={metadata.useCase}
            onChange={(e) => setMetadata((m) => ({ ...m, useCase: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--wrp-text)' }}>
            Document Date
          </label>
          <input
            type="date"
            className={inputClass}
            style={inputStyle}
            value={metadata.date}
            onChange={(e) => setMetadata((m) => ({ ...m, date: e.target.value }))}
          />
        </div>
      </div>

      {/* Editor.js canvas */}
      <div
        className="border rounded-lg p-6 bg-white shadow-sm min-h-[480px] prose prose-sm max-w-none"
        style={{ borderColor: 'var(--wrp-accent)' }}
      >
        <div ref={holderRef} />
      </div>

      {error && (
        <p className="text-sm px-3 py-2 rounded" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
          {error}
        </p>
      )}

      {/* Action bar */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isCommitting}
          className="px-4 py-2 text-sm font-medium border rounded-md transition-opacity"
          style={{ borderColor: 'var(--wrp-secondary)', color: 'var(--wrp-text)', opacity: isCommitting ? 0.5 : 1 }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCommit}
          disabled={isCommitting}
          className="px-6 py-2 text-sm font-medium text-white rounded-md transition-opacity"
          style={{ backgroundColor: 'var(--wrp-primary)', opacity: isCommitting ? 0.6 : 1 }}
        >
          {isCommitting ? 'Embedding & saving…' : 'Confirm & Ingest'}
        </button>
      </div>
    </div>
  );
}
