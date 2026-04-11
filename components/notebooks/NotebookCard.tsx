import type { Notebook } from "@/app/generated/prisma/client";
import { VisibilityBadge } from "./VisibilityBadge";

interface Props {
  notebook: Notebook;
}

export function NotebookCard({ notebook }: Props) {
  return (
    <a
      href={`/notebooks/${notebook.id}`}
      className="block rounded-xl border p-4 transition-shadow hover:shadow-md"
      style={{
        backgroundColor: "white",
        borderColor: "var(--wrp-accent)",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h2
          className="font-semibold text-base leading-snug"
          style={{ color: "var(--wrp-primary)" }}
        >
          {notebook.name}
        </h2>
        <VisibilityBadge visibility={notebook.visibility} />
      </div>

      {notebook.description && (
        <p
          className="text-sm line-clamp-2 mb-3"
          style={{ color: "var(--wrp-text-muted)" }}
        >
          {notebook.description}
        </p>
      )}

      <p className="text-xs" style={{ color: "var(--wrp-text-muted)" }}>
        Updated {new Date(notebook.updatedAt).toLocaleDateString()}
      </p>
    </a>
  );
}
