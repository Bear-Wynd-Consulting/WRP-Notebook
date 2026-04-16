"use client";

import { useTransition } from "react";
import { updateNotebookDatabases } from "@/app/(dashboard)/notebooks/[id]/actions";

export const WRP_DATABASES = [
  {
    id: "wrp_spaces",
    label: "Properties & Spaces",
    description: "Buildings, suites, and available space listings",
  },
  {
    id: "wrp_tenants",
    label: "Tenants & Assets",
    description: "Tenant records, assets, and tenant actions",
  },
  {
    id: "wrp_maintenance",
    label: "Maintenance",
    description: "Maintenance tickets and ticket history",
  },
  {
    id: "wrp_inquiries",
    label: "Inquiries & Leads",
    description: "Inquiry sessions, messages, leads, and screening logs",
  },
  {
    id: "wrp_communications",
    label: "Automated Replies",
    description: "Automated reply rules and communication templates",
  },
] as const;

interface Props {
  notebookId: string;
  /** Currently enabled database IDs for this notebook */
  enabledDatabases: string[];
}

export function DatabaseSelector({ notebookId, enabledDatabases }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateNotebookDatabases(notebookId, fd);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        {WRP_DATABASES.map((db) => {
          const checked = enabledDatabases.includes(db.id);
          return (
            <label
              key={db.id}
              className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
              style={{
                borderColor: checked ? "var(--wrp-primary)" : "var(--wrp-accent)",
                backgroundColor: checked ? "var(--wrp-accent)" : "white",
              }}
            >
              <input
                type="checkbox"
                name="databases"
                value={db.id}
                defaultChecked={checked}
                className="mt-0.5 shrink-0"
                style={{ accentColor: "var(--wrp-primary)" }}
              />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--wrp-dark)" }}>
                  {db.label}
                </p>
                <p className="text-xs" style={{ color: "var(--wrp-text-muted)" }}>
                  {db.description}
                </p>
              </div>
            </label>
          );
        })}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 text-white text-sm font-medium rounded-md transition-opacity"
        style={{
          backgroundColor: "var(--wrp-primary)",
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? "Saving…" : "Save Database Access"}
      </button>
    </form>
  );
}
