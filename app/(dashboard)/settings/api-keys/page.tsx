/**
 * Admin: API key management page.
 * Only accessible to users with role === 'admin'.
 */
import { auth } from "@/lib/auth/auth-config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { toPublicApiKey } from "@/lib/api/response-filters";

export default async function ApiKeysPage() {
  const session = await auth();

  if (session?.user.role !== "admin") {
    redirect("/");
  }

  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
  });

  const publicKeys = keys.map(toPublicApiKey);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--wrp-primary)" }}
        >
          API Keys
        </h1>
      </div>

      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--wrp-accent)" }}>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: "var(--wrp-accent)" }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--wrp-dark)" }}>Name</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--wrp-dark)" }}>Prefix</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--wrp-dark)" }}>Scope</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--wrp-dark)" }}>Status</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--wrp-dark)" }}>Last used</th>
            </tr>
          </thead>
          <tbody>
            {publicKeys.map((key) => (
              <tr
                key={key.id}
                className="border-t"
                style={{ borderColor: "var(--wrp-accent)" }}
              >
                <td className="px-4 py-3 font-medium">{key.name}</td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--wrp-text-muted)" }}>
                  {key.keyPrefix}…
                </td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{
                      backgroundColor:
                        key.scope === "ADMIN"
                          ? "var(--wrp-primary)"
                          : key.scope === "INTERNAL"
                          ? "var(--wrp-dark)"
                          : "var(--wrp-secondary)",
                      color: "white",
                    }}
                  >
                    {key.scope}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {key.revokedAt ? (
                    <span className="text-red-500 text-xs">Revoked</span>
                  ) : key.expiresAt && new Date(key.expiresAt) < new Date() ? (
                    <span className="text-amber-500 text-xs">Expired</span>
                  ) : (
                    <span className="text-green-600 text-xs">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--wrp-text-muted)" }}>
                  {key.lastUsedAt
                    ? new Date(key.lastUsedAt).toLocaleDateString()
                    : "Never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {publicKeys.length === 0 && (
          <p
            className="text-center py-8 text-sm"
            style={{ color: "var(--wrp-text-muted)" }}
          >
            No API keys yet. Create one via POST /api/v1/admin/api-keys
          </p>
        )}
      </div>
    </div>
  );
}
