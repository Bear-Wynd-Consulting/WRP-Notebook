"use server";

/**
 * Server Actions for the notebook detail page.
 * All actions require a valid NextAuth session and ownership of the notebook.
 *
 * Source type pipeline overview:
 *  text     → content stored directly → processSourceSync → chunk + embed
 *  url      → URL stored in metadata  → processSourceSync fetches URL → chunk + embed
 *  youtube  → URL stored in metadata  → processSourceSync fetches transcript → chunk + embed
 *  pdf      → two-phase extract/commit flow via /api/v1/sources/extract and /commit
 *  audio    → not yet implemented
 *
 * Source management is available for all notebook visibility types
 * (PRIVATE, INTERNAL, PUBLIC). Visibility controls API access, not
 * who can add sources via the dashboard.
 *
 * NOTE: redirect() must never be called inside a try/catch block.
 * It throws NEXT_REDIRECT internally; calling it inside catch causes
 * the redirect to be swallowed by the client's error handler.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/auth-config";
import { prisma } from "@/lib/db/client";
import { getNotebookForUser, createAuditLog } from "@/lib/db/scoped-queries";
import { createSourceSchema } from "@/lib/validation/schemas";
import { validateIngestUrl } from "@/lib/security/url-validator";
import { processSourceSync } from "@/lib/jobs/process-source-sync";

// ─── Source Actions ────────────────────────────────────────────────────────────

/**
 * Add a URL, YouTube, or plain-text source to a notebook.
 *
 * Works for all notebook visibility types (PRIVATE, INTERNAL, PUBLIC).
 */
export async function addTextOrUrlSource(notebookId: string, formData: FormData) {
  const session = await auth();
  if (!session) redirect("/login");

  const notebook = await getNotebookForUser(notebookId, session.user.id);
  if (!notebook) redirect("/");

  const raw = {
    type: formData.get("type"),
    title: formData.get("title") || undefined,
    url: formData.get("url") || undefined,
    text: formData.get("text") || undefined,
  };

  const parsed = createSourceSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/notebooks/${notebookId}?source_error=invalid`);
  }

  const data = parsed.data;

  // Validate URL outside a try/catch — redirect() must not be called inside catch.
  let urlError = false;
  if ((data.type === "url" || data.type === "youtube") && data.url) {
    try {
      await validateIngestUrl(data.url);
    } catch {
      urlError = true;
    }
  }
  if (urlError) redirect(`/notebooks/${notebookId}?source_error=url`);

  const isUrlType = data.type === "url" || data.type === "youtube";

  const source = await prisma.source.create({
    data: {
      type: data.type,
      title: data.title ?? (data.url ? new URL(data.url).hostname : "Text"),
      content: data.type === "text" ? data.text : undefined,
      metadata: isUrlType && data.url ? { url: data.url } : undefined,
      uploadedBy: session.user.id,
      status: "PENDING",
      notebooks: {
        create: { notebookId },
      },
    },
  });

  try {
    await processSourceSync(source.id);
  } catch (err) {
    console.error("[processSourceSync.failed]", {
      sourceId: source.id,
      error: err instanceof Error ? err.message : String(err),
    });
    // Source is marked ERROR by processSourceSync — continue to audit log.
  }

  await createAuditLog({
    action: "source.create",
    actorType: "user",
    actorId: session.user.id,
    resource: `source:${source.id}`,
    metadata: { notebookId, type: source.type },
  });

  revalidatePath(`/notebooks/${notebookId}`);
}

/**
 * Add a file source to a notebook.
 *
 * PDFs use the two-phase extract/commit flow (/api/v1/sources/extract + /commit)
 * and should never reach this action. Audio support is not yet implemented.
 */
export async function addFileSource(notebookId: string, _formData: FormData) {
  const session = await auth();
  if (!session) redirect("/login");
  redirect(`/notebooks/${notebookId}?source_error=not_implemented`);
}

// ─── Database Selection Action ─────────────────────────────────────────────────

/**
 * Update the list of WRP databases enabled for a notebook.
 */
export async function updateNotebookDatabases(notebookId: string, formData: FormData) {
  const session = await auth();
  if (!session) redirect("/login");

  const notebook = await getNotebookForUser(notebookId, session.user.id);
  if (!notebook) redirect("/");

  const selected = formData.getAll("databases") as string[];

  const VALID_DB_IDS = new Set([
    "wrp_spaces",
    "wrp_tenants",
    "wrp_maintenance",
    "wrp_inquiries",
    "wrp_leads",
    "wrp_communications",
  ]);
  const sanitised = selected.filter((id) => VALID_DB_IDS.has(id));

  await prisma.notebook.update({
    where: { id: notebookId },
    data: { databases: sanitised },
  });

  await createAuditLog({
    action: "notebook.databases_updated",
    actorType: "user",
    actorId: session.user.id,
    resource: `notebook:${notebookId}`,
    metadata: { databases: sanitised },
  });

  revalidatePath(`/notebooks/${notebookId}`);
}
