/**
 * Ownership-filtered Prisma query wrappers.
 *
 * SECURITY: All data access must go through these helpers.
 * NEVER call prisma.notebook.findMany() (etc.) directly in route handlers.
 * Every query includes ownerId / visibility / scope filters to prevent IDOR.
 */
import { Prisma, Visibility } from "@/app/generated/prisma/client";
import { prisma } from "./client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiKeyContext {
  id: string;
  scope: "ADMIN" | "INTERNAL" | "EXTERNAL";
  permissions: string[];
  notebookIds: string[]; // empty = all allowed by scope
}

// ─── Notebooks ────────────────────────────────────────────────────────────────

/** UI / NextAuth session — returns notebooks owned by the authenticated user. */
export async function getNotebooksForUser(userId: string) {
  return prisma.notebook.findMany({
    where: { ownerId: userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });
}

/** Public API — notebooks visible to the API key's scope. */
export async function getNotebooksForApiKey(ctx: ApiKeyContext) {
  const where: Prisma.NotebookWhereInput = { deletedAt: null };

  if (ctx.scope === "EXTERNAL") {
    where.visibility = "PUBLIC";
  } else if (ctx.scope === "INTERNAL") {
    where.visibility = { in: ["PUBLIC", "INTERNAL"] as Visibility[] };
  }
  // ADMIN sees all non-deleted notebooks

  if (ctx.notebookIds.length > 0) {
    where.id = { in: ctx.notebookIds };
  }

  return prisma.notebook.findMany({ where, orderBy: { updatedAt: "desc" } });
}

/** Get a single notebook, filtered by API key context. Returns null if not found or unauthorised. */
export async function getNotebookForApiKey(
  notebookId: string,
  ctx: ApiKeyContext
) {
  const where: Prisma.NotebookWhereInput = { id: notebookId, deletedAt: null };

  if (ctx.scope === "EXTERNAL") {
    where.visibility = "PUBLIC";
  } else if (ctx.scope === "INTERNAL") {
    where.visibility = { in: ["PUBLIC", "INTERNAL"] as Visibility[] };
  }

  if (ctx.notebookIds.length > 0 && !ctx.notebookIds.includes(notebookId)) {
    return null;
  }

  return prisma.notebook.findFirst({ where });
}

/** Get a single notebook owned by user. Returns null if not found or not owned. */
export async function getNotebookForUser(
  notebookId: string,
  userId: string
) {
  return prisma.notebook.findFirst({
    where: { id: notebookId, ownerId: userId, deletedAt: null },
  });
}

// ─── Sources ──────────────────────────────────────────────────────────────────

/** Sources for a notebook — scoped via join table. */
export async function getSourcesForNotebook(notebookId: string) {
  return prisma.source.findMany({
    where: {
      notebooks: { some: { notebookId } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSourceById(sourceId: string) {
  return prisma.source.findUnique({ where: { id: sourceId } });
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export async function getNotesForNotebook(notebookId: string) {
  return prisma.note.findMany({
    where: {
      deletedAt: null,
      notebooks: { some: { notebookId } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getNoteById(noteId: string) {
  return prisma.note.findUnique({ where: { id: noteId } });
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function createChatSession(notebookId: string, title: string) {
  return prisma.chatSession.create({
    data: { notebookId, title },
  });
}

export async function getChatSessionsForNotebook(notebookId: string) {
  return prisma.chatSession.findMany({
    where: { notebookId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getChatMessagesForSession(chatSessionId: string) {
  return prisma.chatMessage.findMany({
    where: { chatSessionId },
    orderBy: { createdAt: "asc" },
  });
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export async function createAuditLog(entry: {
  action: string;
  actorType: "user" | "api_key" | "system";
  actorId: string;
  resource: string;
  metadata?: Record<string, unknown>;
}) {
  // Fire-and-forget — never let audit logging break the main request
  return prisma.auditLog
    .create({
      data: {
        action: entry.action,
        actorType: entry.actorType,
        actorId: entry.actorId,
        resource: entry.resource,
        metadata: (entry.metadata ?? {}) as Record<string, string>,
      },
    })
    .catch((err: unknown) => console.error("Audit log write failed:", err));
}
