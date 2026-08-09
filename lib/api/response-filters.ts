/**
 * Response filters — strip internal fields before sending to API consumers.
 *
 * NEVER return blobUrl, keyHash, ownerId, or other internal fields to clients.
 * Every API route handler must use these functions before Response.json().
 */
import type {
  Notebook,
  Source,
  Note,
  ChatSession,
  ChatMessage,
  ApiKey,
} from "@/app/generated/prisma/client";
import type { ContractFields } from "@/lib/validation/contract-schema";

// ─── Notebooks ────────────────────────────────────────────────────────────────

export function toPublicNotebook(nb: Notebook) {
  // Omit ownerId (internal), deletedAt (internal)
  return {
    id: nb.id,
    name: nb.name,
    description: nb.description,
    visibility: nb.visibility,
    createdAt: nb.createdAt,
    updatedAt: nb.updatedAt,
  };
}

// ─── Sources ──────────────────────────────────────────────────────────────────

export function toPublicSource(src: Source) {
  // Omit blobUrl (internal storage path), uploadedBy (internal)
  const metadata = src.metadata as { documentType?: string; contract?: ContractFields } | null;
  const isContract = metadata?.documentType === "contract";
  return {
    id: src.id,
    type: src.type,
    title: src.title,
    summary: src.summary,
    status: src.status,
    mimeType: src.mimeType,
    fileSize: src.fileSize,
    createdAt: src.createdAt,
    updatedAt: src.updatedAt,
    documentType: isContract ? "contract" : null,
    contract: isContract ? metadata!.contract ?? null : null,
  };
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export function toPublicNote(note: Note) {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export function toPublicChatSession(session: ChatSession) {
  return {
    id: session.id,
    notebookId: session.notebookId,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export function toPublicChatMessage(msg: ChatMessage) {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    citations: msg.citations,
    createdAt: msg.createdAt,
  };
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

export function toPublicApiKey(key: ApiKey) {
  // NEVER return keyHash — only prefix for identification
  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    scope: key.scope,
    permissions: key.permissions,
    notebookIds: key.notebookIds,
    rateLimit: key.rateLimit,
    expiresAt: key.expiresAt,
    lastUsedAt: key.lastUsedAt,
    createdAt: key.createdAt,
    revokedAt: key.revokedAt,
  };
}
