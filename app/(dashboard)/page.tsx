/**
 * Dashboard home — notebook list for the authenticated user.
 */
import { auth } from "@/lib/auth/auth-config";
import { getNotebooksForUser } from "@/lib/db/scoped-queries";
import { NotebookCard } from "@/components/notebooks/NotebookCard";
import type { Notebook } from "@/app/generated/prisma/client";

export default async function DashboardPage() {
  const session = await auth();
  const notebooks = await getNotebooksForUser(session!.user.id);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--wrp-primary)" }}
          >
            My Notebooks
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--wrp-text-muted)" }}>
            {notebooks.length} notebook{notebooks.length !== 1 ? "s" : ""}
          </p>
        </div>
        <a
          href="/notebooks/new"
          className="px-4 py-2 text-white text-sm font-medium rounded-md transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--wrp-primary)" }}
        >
          New Notebook
        </a>
      </div>

      {notebooks.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl border-2 border-dashed"
          style={{
            borderColor: "var(--wrp-accent)",
            color: "var(--wrp-text-muted)",
          }}
        >
          <p className="text-lg font-medium mb-2">No notebooks yet</p>
          <p className="text-sm mb-4">
            Create your first notebook to start organising research
          </p>
          <a
            href="/notebooks/new"
            className="px-4 py-2 text-white text-sm font-medium rounded-md transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--wrp-primary)" }}
          >
            Create Notebook
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notebooks.map((nb: Notebook) => (
            <NotebookCard key={nb.id} notebook={nb} />
          ))}
        </div>
      )}
    </div>
  );
}
