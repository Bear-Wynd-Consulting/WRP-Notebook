/**
 * Admin: all notebooks across all owners.
 * Only accessible to users with role === 'admin' — lets an admin navigate to
 * (and generate API keys for) notebooks they don't personally own.
 */
import { auth } from "@/lib/auth/auth-config";
import { redirect } from "next/navigation";
import { getAllNotebooksAdmin, getUsersByIds } from "@/lib/db/scoped-queries";
import { VisibilityBadge } from "@/components/notebooks/VisibilityBadge";

export default async function AllNotebooksPage() {
  const session = await auth();

  if (session?.user.role !== "admin") {
    redirect("/");
  }

  const notebooks = await getAllNotebooksAdmin();
  const owners = await getUsersByIds([...new Set(notebooks.map((nb) => nb.ownerId))]);
  const ownerEmailById = new Map(owners.map((u) => [u.id, u.email]));

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--wrp-primary)" }}
        >
          All Notebooks
        </h1>
        <p className="text-sm" style={{ color: "var(--wrp-text-muted)" }}>
          {notebooks.length} notebook{notebooks.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--wrp-accent)" }}>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: "var(--wrp-accent)" }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--wrp-dark)" }}>Name</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--wrp-dark)" }}>Owner</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--wrp-dark)" }}>Visibility</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--wrp-dark)" }}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {notebooks.map((nb) => (
              <tr
                key={nb.id}
                className="border-t"
                style={{ borderColor: "var(--wrp-accent)" }}
              >
                <td className="px-4 py-3">
                  <a
                    href={`/notebooks/${nb.id}`}
                    className="font-medium hover:underline"
                    style={{ color: "var(--wrp-primary)" }}
                  >
                    {nb.name}
                  </a>
                </td>
                <td className="px-4 py-3" style={{ color: "var(--wrp-text-muted)" }}>
                  {ownerEmailById.get(nb.ownerId) ?? nb.ownerId}
                </td>
                <td className="px-4 py-3">
                  <VisibilityBadge visibility={nb.visibility} />
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--wrp-text-muted)" }}>
                  {new Date(nb.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {notebooks.length === 0 && (
          <p
            className="text-center py-8 text-sm"
            style={{ color: "var(--wrp-text-muted)" }}
          >
            No notebooks yet.
          </p>
        )}
      </div>
    </div>
  );
}
