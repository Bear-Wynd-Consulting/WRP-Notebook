"use server";

/**
 * Server Actions for the notebook detail page.
 * All actions require a valid NextAuth session and ownership of the notebook.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/auth-config";
import { prisma } from "@/lib/db/client";
import { getNotebookForUser, createAuditLog } from "@/lib/db/scoped-queries";
import { createSourceSchema } from "@/lib/validation/schemas";
import { validateIngestUrl } from "@/lib/security/url-validator";
import { inngest } from "@/lib/jobs/client";

// ─── Source Actions ────────────────────────────────────────────────────────────

/**
 * Add a URL or text source to a notebook.
 * Handles: url, youtube, text source types.
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

  if ((data.type === "url" || data.type === "youtube") && data.url) {
    try {
      await validateIngestUrl(data.url);
    } catch {
      redirect(`/notebooks/${notebookId}?source_error=url`);
    }
  }

  const source = await prisma.source.create({
    data: {
      type: data.type,
      title: data.title ?? (data.url ? new URL(data.url).hostname : "Text"),
      content: data.text,
      uploadedBy: session.user.id,
      status: "PENDING",
      notebooks: {
        create: { notebookId },
      },
    },
  });

  await inngest.send({ name: "source/uploaded", data: { sourceId: source.id } });

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
 * Add a PDF (or other file) source to a notebook.
 * File is stored as base64 in content for background processing.
 */
export async function addFileSource(notebookId: string, formData: FormData) {
  const session = await auth();
  if (!session) redirect("/login");

  const notebook = await getNotebookForUser(notebookId, session.user.id);
  if (!notebook) redirect("/");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    redirect(`/notebooks/${notebookId}?source_error=no_file`);
  }

  if (file.size > 10 * 1024 * 1024) {
    redirect(`/notebooks/${notebookId}?source_error=too_large`);
  }

  // Read first 4 bytes for magic-byte MIME detection in the background job
  const arrayBuffer = await file.arrayBuffer();
  // Store as base64 so the binary survives text storage
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  // Sanitise filename: strip path separators and control characters
  const safeName = file.name.replace(/[/\\<>:"|?*\x00-\x1f]/g, "_").slice(0, 255);

  const source = await prisma.source.create({
    data: {
      type: "pdf",
      title: safeName,
      content: base64,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      uploadedBy: session.user.id,
      status: "PENDING",
      notebooks: {
        create: { notebookId },
      },
    },
  });

  await inngest.send({ name: "source/uploaded", data: { sourceId: source.id } });

  await createAuditLog({
    action: "source.create",
    actorType: "user",
    actorId: session.user.id,
    resource: `source:${source.id}`,
    metadata: { notebookId, type: "pdf", filename: safeName },
  });

  revalidatePath(`/notebooks/${notebookId}`);
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

  // Collect all checked database IDs from the form
  const selected = formData.getAll("databases") as string[];

  // Allowlist: only accept known WRP database identifiers
  const VALID_DB_IDS = new Set([
    "wrp_spaces",
    "wrp_tenants",
    "wrp_maintenance",
    "wrp_inquiries",
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
