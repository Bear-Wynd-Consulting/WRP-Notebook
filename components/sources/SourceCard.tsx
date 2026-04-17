import type { Source } from "@/app/generated/prisma/client";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "#FFF3CD", text: "#856404", label: "Pending" },
  PROCESSING: { bg: "#CCE5FF", text: "#004085", label: "Processing…" },
  READY: { bg: "#D4EDDA", text: "#155724", label: "Ready" },
  ERROR: { bg: "#F8D7DA", text: "#721C24", label: "Error" },
};

interface Props {
  source: Source;
}

export function SourceCard({ source }: Props) {
  const status = STATUS_STYLES[source.status] ?? STATUS_STYLES.PENDING;

  return (
    <div
      className="rounded-lg border p-3 space-y-2"
      style={{ backgroundColor: "white", borderColor: "var(--wrp-accent)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className="font-medium text-sm leading-snug"
          style={{ color: "var(--wrp-text)" }}
        >
          {source.title ?? source.type.toUpperCase()}
        </p>
        <span
          className="px-2 py-0.5 rounded text-xs font-medium shrink-0"
          style={{ backgroundColor: status.bg, color: status.text }}
        >
          {status.label}
        </span>
      </div>

      {source.status === "PENDING" && (
        <p className="text-xs px-2 py-1 rounded" style={{ backgroundColor: "#FFF3CD", color: "#856404" }}>
          Awaiting processing. If this stays pending, check that INNGEST_SIGNING_KEY and INNGEST_EVENT_KEY are set.
        </p>
      )}

      {source.summary && (
        <p
          className="text-xs line-clamp-3"
          style={{ color: "var(--wrp-text-muted)" }}
        >
          {source.summary}
        </p>
      )}

      <p className="text-xs" style={{ color: "var(--wrp-text-muted)" }}>
        {source.type.toUpperCase()}
        {source.fileSize
          ? ` · ${(source.fileSize / 1024).toFixed(0)} KB`
          : ""}
        {" · "}
        {new Date(source.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}
