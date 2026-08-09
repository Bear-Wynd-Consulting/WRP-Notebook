import type { Source } from "@/app/generated/prisma/client";
import type { ContractFields } from "@/lib/validation/contract-schema";

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
  const metadata = source.metadata as { documentType?: string; contract?: ContractFields } | null;
  const contract = metadata?.documentType === "contract" ? metadata.contract : null;

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
        <div className="flex items-center gap-1 shrink-0">
          {contract && (
            <span
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: "var(--wrp-accent)", color: "var(--wrp-primary)" }}
            >
              Contract
            </span>
          )}
          <span
            className="px-2 py-0.5 rounded text-xs font-medium"
            style={{ backgroundColor: status.bg, color: status.text }}
          >
            {status.label}
          </span>
        </div>
      </div>

      {contract && (
        <p className="text-xs" style={{ color: "var(--wrp-text)" }}>
          {contract.tenantName && contract.tenantName !== "unclear"
            ? contract.tenantName
            : "Tenant: unknown"}
          {contract.leaseEndDate && contract.leaseEndDate !== "unclear"
            ? ` · Lease ends ${contract.leaseEndDate}`
            : ""}
        </p>
      )}

      {source.status === "PENDING" && (
        <p className="text-xs px-2 py-1 rounded" style={{ backgroundColor: "#FFF3CD", color: "#856404" }}>
          Awaiting processing. This normally completes within the same upload request — if it stays pending, the request may have been interrupted (e.g. a large file timing out); try re-uploading.
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
