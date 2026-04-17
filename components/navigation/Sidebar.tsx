"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import type { Notebook } from "@/app/generated/prisma/client";

interface Props {
  notebooks: Notebook[];
}

const VISIBILITY_LABELS: Record<string, string> = {
  PRIVATE: "Private",
  INTERNAL: "Internal",
  PUBLIC: "Public",
};

const VISIBILITY_COLORS: Record<string, { bg: string; text: string }> = {
  PRIVATE: { bg: "#F3E8FF", text: "#6B21A8" },
  INTERNAL: { bg: "#DBEAFE", text: "#1E40AF" },
  PUBLIC: { bg: "#D1FAE5", text: "#065F46" },
};

export function Sidebar({ notebooks }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col shrink-0 border-r transition-all duration-200"
      style={{
        width: collapsed ? "56px" : "220px",
        backgroundColor: "var(--wrp-surface)",
        borderColor: "var(--wrp-accent)",
        minHeight: "100vh",
      }}
    >
      {/* Collapse toggle */}
      <div
        className="flex items-center justify-end px-2 py-3 border-b"
        style={{ borderColor: "var(--wrp-accent)" }}
      >
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-1 rounded hover:bg-white transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{ color: "var(--wrp-secondary)" }}
        >
          {collapsed ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        {/* Notebooks section */}
        {!collapsed && (
          <p
            className="px-3 mb-1 text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--wrp-secondary)" }}
          >
            My Notebooks
          </p>
        )}

        <ul className="space-y-0.5 px-2">
          {notebooks.map((nb) => {
            const isActive = pathname === `/notebooks/${nb.id}`;
            const vc = VISIBILITY_COLORS[nb.visibility] ?? VISIBILITY_COLORS.PRIVATE;

            return (
              <li key={nb.id}>
                <a
                  href={`/notebooks/${nb.id}`}
                  title={collapsed ? nb.name : undefined}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors"
                  style={{
                    backgroundColor: isActive ? "var(--wrp-accent)" : "transparent",
                    color: isActive ? "var(--wrp-primary)" : "var(--wrp-text)",
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {/* Icon */}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="shrink-0"
                    style={{ color: isActive ? "var(--wrp-primary)" : "var(--wrp-secondary)" }}
                  >
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>

                  {!collapsed && (
                    <span className="flex-1 truncate">{nb.name}</span>
                  )}

                  {!collapsed && (
                    <span
                      className="px-1.5 py-0.5 rounded text-xs shrink-0"
                      style={{ backgroundColor: vc.bg, color: vc.text, fontSize: "10px" }}
                    >
                      {VISIBILITY_LABELS[nb.visibility]}
                    </span>
                  )}
                </a>
              </li>
            );
          })}

          {notebooks.length === 0 && !collapsed && (
            <li className="px-2 py-2 text-xs" style={{ color: "var(--wrp-text-muted)" }}>
              No notebooks yet.
            </li>
          )}
        </ul>

        {/* New notebook link */}
        <div className="px-2 mt-3">
          <a
            href="/notebooks/new"
            title={collapsed ? "New notebook" : undefined}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-white"
            style={{ color: "var(--wrp-primary)" }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            {!collapsed && <span className="font-medium">New Notebook</span>}
          </a>
        </div>
      </nav>
    </aside>
  );
}
