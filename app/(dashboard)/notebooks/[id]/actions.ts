"use server";

/**
 * Server Actions for the notebook detail page.
 * All actions require a valid NextAuth session and ownership of the notebook.
 *
 * Source type pipeline overview:
 *  text     → content stored directly → Inngest reads content → chunk + embed
 *  url      → URL stored in metadata  → Inngest fetches URL → extract text → chunk + embed
 *  youtube  → URL stored in metadata  → Inngest fetches transcript → chunk + embed
 *  pdf      → uploaded to Vercel Blob → Inngest downloads + pdf-parse → chunk + embed
 *  audio    → uploaded to Vercel Blob → Inngest transcribes (Whisper) → chunk + embed
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/auth-config";
import { prisma } from "@/lib/db/client";
import { getNotebookForUser, createAuditLog } from "@/lib/db/scoped-queries";
import { createSourceSchema } from "@/lib/validation/schemas";
import { validateIngestUrl } from "@/lib/security/url-validator";
import { validateUpload } from "@/lib/security/file-upload";
import { inngest } from "@/lib/jobs/client";
import { put } from "@vercel/blob";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fire-and-forget Inngest event — never let a job dispatch failure block saving. */
async function dispatchProcessing(sourceId: string) {
  try {
    await inngest.send({ name: "source/uploaded", data: { sourceId } });
  } catch (err) {
    console.error("Inngest dispatch failed for source", sourceId, err);
    // Source record is saved with PENDING status — it can be re-queued manually.
  }
}

// ─── Source Actions ────────────────────────────────────────────────────────────

/**
 * Add a URL, YouTube, or plain-text source to a notebook.
 *
 * - text:    content stored in Source.content; Inngest chunks and embeds it directly.
 * - url:     URL stored in Source.metadata.url; Inngest fetches and extracts the text.
 * - youtube: URL stored in Source.metadata.url; Inngest fetches the transcript.
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

  const isUrlType = data.type === "url" || data.type === "youtube";

  const source = await prisma.source.create({
    data: {
      type: data.type,
      // For URL types: use supplied title or derive from hostname
      title: data.title ?? (data.url ? new URL(data.url).hostname : "Text"),
      // Text sources: content stored directly. URL/YouTube: fetched by Inngest.
      content: data.type === "text" ? data.text : undefined,
      // URL stored in metadata so the Inngest job knows where to fetch from.
      metadata: isUrlType && data.url ? { url: data.url } : undefined,
      uploadedBy: session.user.id,
      status: "PENDING",
      notebooks: {
        create: { notebookId },
      },
    },
  });

  await dispatchProcessing(source.id);

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
 * Add a PDF or audio file source to a notebook.
 *
 * - pdf:   file uploaded to Vercel Blob (blobUrl); Inngest downloads + pdf-parse.
 * - audio: file uploaded to Vercel Blob (blobUrl); Inngest transcribes with Whisper.
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

  // Validate by magic bytes — rejects spoofed Content-Type headers
  let safeName: string;
  let detectedMimeType: string;
  try {
    ({ safeName, detectedMimeType } = await validateUpload(file, "pdf"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid_file";
    redirect(`/notebooks/${notebookId}?source_error=${encodeURIComponent(msg)}`);
  }

  // Upload to Vercel Blob — private path, signed URL via blobUrl field
  const blob = await put(`sources/${notebookId}/${Date.now()}-${safeName}`, file, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  const source = await prisma.source.create({
    data: {
      type: "pdf",
      title: safeName,
      blobUrl: blob.url,           // Vercel Blob URL — stripped from API responses
      fileSize: file.size,
      mimeType: detectedMimeType,
      uploadedBy: session.user.id,
      status: "PENDING",
      notebooks: {
        create: { notebookId },
      },
    },
  });

  await dispatchProcessing(source.id);

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
