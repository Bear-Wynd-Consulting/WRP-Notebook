import type { Note } from "@/app/generated/prisma/client";

interface Props {
  note: Note;
}

export function NoteCard({ note }: Props) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ backgroundColor: "white", borderColor: "var(--wrp-accent)" }}
    >
      {note.title && (
        <h3
          className="font-medium mb-2"
          style={{ color: "var(--wrp-primary)" }}
        >
          {note.title}
        </h3>
      )}
      <p
        className="text-sm whitespace-pre-wrap line-clamp-4"
        style={{ color: "var(--wrp-text)" }}
      >
        {note.content}
      </p>
      <p
        className="text-xs mt-3"
        style={{ color: "var(--wrp-text-muted)" }}
      >
        {new Date(note.updatedAt).toLocaleDateString()}
      </p>
    </div>
  );
}
