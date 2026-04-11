/**
 * Notebook detail page — sources, notes, and chat interface.
 */
import { auth } from "@/lib/auth/auth-config";
import { getNotebookForUser, getSourcesForNotebook, getNotesForNotebook } from "@/lib/db/scoped-queries";
import { notFound } from "next/navigation";
import { SourceCard } from "@/components/sources/SourceCard";
import { NoteCard } from "@/components/notes/NoteCard";
import { VisibilityBadge } from "@/components/notebooks/VisibilityBadge";
import type { Source, Note } from "@/app/generated/prisma/client";

export default async function NotebookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  const [notebook, sources, notes] = await Promise.all([
    getNotebookForUser(id, session!.user.id),
    getSourcesForNotebook(id),
    getNotesForNotebook(id),
  ]);

  if (!notebook) notFound();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--wrp-primary)" }}
            >
              {notebook.name}
            </h1>
            <VisibilityBadge visibility={notebook.visibility} />
          </div>
          {notebook.description && (
            <p className="text-sm" style={{ color: "var(--wrp-text-muted)" }}>
              {notebook.description}
            </p>
          )}
        </div>
        <a
          href="/"
          className="text-sm transition-colors"
          style={{ color: "var(--wrp-text-muted)" }}
        >
          ← Back
        </a>
      </div>

      {/* Sources */}
      <section>
        <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--wrp-dark)" }}>
          Sources ({sources.length})
        </h2>
        {sources.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--wrp-text-muted)" }}>
            No sources yet. Add PDFs, URLs, or text to this notebook.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sources.map((src: Source) => (
              <SourceCard key={src.id} source={src} />
            ))}
          </div>
        )}
      </section>

      {/* Notes */}
      <section>
        <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--wrp-dark)" }}>
          Notes ({notes.length})
        </h2>
        {notes.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--wrp-text-muted)" }}>
            No notes yet.
          </p>
        ) : (
          <div className="space-y-3">
            {notes.map((note: Note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
