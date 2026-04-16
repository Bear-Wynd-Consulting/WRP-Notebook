/**
 * Create new notebook page — uses a Server Action so the session user owns the notebook.
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth-config";
import { prisma } from "@/lib/db/client";
import { createAuditLog } from "@/lib/db/scoped-queries";
import { createNotebookSchema } from "@/lib/validation/schemas";

async function createNotebook(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session) redirect("/login");

  const parsed = createNotebookSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    visibility: formData.get("visibility"),
  });

  if (!parsed.success) {
    // Redirect back with a generic error — no stack traces exposed
    redirect("/notebooks/new?error=invalid");
  }

  const notebook = await prisma.notebook.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      visibility: parsed.data.visibility,
      ownerId: session.user.id,
    },
  });

  await createAuditLog({
    action: "notebook.create",
    actorType: "user",
    actorId: session.user.id,
    resource: `notebook:${notebook.id}`,
    metadata: { name: parsed.data.name, visibility: parsed.data.visibility },
  });

  redirect(`/notebooks/${notebook.id}`);
}

export default async function NewNotebookPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="max-w-lg">
      <h1
        className="text-2xl font-bold mb-6"
        style={{ color: "var(--wrp-primary)" }}
      >
        New Notebook
      </h1>

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-md text-sm"
          style={{
            backgroundColor: "var(--wrp-accent)",
            color: "var(--wrp-dark)",
          }}
        >
          Please check your input and try again.
        </div>
      )}

      <form action={createNotebook} className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium mb-1"
            style={{ color: "var(--wrp-text)" }}
          >
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={200}
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none"
            style={{ borderColor: "var(--wrp-secondary)" }}
            placeholder="e.g. Building 100 Research"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium mb-1"
            style={{ color: "var(--wrp-text)" }}
          >
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={2000}
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none resize-none"
            style={{ borderColor: "var(--wrp-secondary)" }}
            placeholder="What is this notebook about?"
          />
        </div>

        <div>
          <label
            htmlFor="visibility"
            className="block text-sm font-medium mb-1"
            style={{ color: "var(--wrp-text)" }}
          >
            Visibility
          </label>
          <select
            id="visibility"
            name="visibility"
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none"
            style={{ borderColor: "var(--wrp-secondary)" }}
          >
            <option value="PRIVATE">Private — only you</option>
            <option value="INTERNAL">Internal — WRP staff API keys</option>
            <option value="PUBLIC">Public — external API keys + website</option>
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="px-4 py-2 text-white text-sm font-medium rounded-md transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--wrp-primary)" }}
          >
            Create Notebook
          </button>
          <a
            href="/"
            className="px-4 py-2 text-sm font-medium rounded-md border transition-colors"
            style={{
              color: "var(--wrp-text-muted)",
              borderColor: "var(--wrp-secondary)",
            }}
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
