-- WRP Notebook — Initial Migration
-- Requires pgvector extension (available on Neon by default)

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'INTERNAL', 'PUBLIC');
CREATE TYPE "ApiScope" AS ENUM ('ADMIN', 'INTERNAL', 'EXTERNAL');
CREATE TYPE "SourceStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERROR');

-- ─── Notebook ─────────────────────────────────────────────────────────────────

CREATE TABLE "Notebook" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "visibility"  "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "ownerId"     TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "deletedAt"   TIMESTAMP(3),

    CONSTRAINT "Notebook_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notebook_ownerId_idx" ON "Notebook"("ownerId");
CREATE INDEX "Notebook_visibility_idx" ON "Notebook"("visibility");
CREATE INDEX "Notebook_deletedAt_idx" ON "Notebook"("deletedAt");

-- ─── Source ───────────────────────────────────────────────────────────────────

CREATE TABLE "Source" (
    "id"         TEXT NOT NULL,
    "type"       TEXT NOT NULL,
    "title"      TEXT,
    "content"    TEXT,
    "summary"    TEXT,
    "metadata"   JSONB,
    "status"     "SourceStatus" NOT NULL DEFAULT 'PENDING',
    "filePath"   TEXT,
    "blobUrl"    TEXT,
    "mimeType"   TEXT,
    "fileSize"   INTEGER,
    "uploadedBy" TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- ─── SourceChunk ──────────────────────────────────────────────────────────────

CREATE TABLE "SourceChunk" (
    "id"         TEXT NOT NULL,
    "sourceId"   TEXT NOT NULL,
    "content"    TEXT NOT NULL,
    "embedding"  vector(1536),
    "chunkIndex" INTEGER NOT NULL,

    CONSTRAINT "SourceChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SourceChunk_sourceId_idx" ON "SourceChunk"("sourceId");

-- IVFFlat index for fast approximate nearest-neighbour search (cosine)
-- Build after initial data load: CREATE INDEX CONCURRENTLY ...
-- CREATE INDEX "SourceChunk_embedding_idx" ON "SourceChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- ─── SourceInsight ────────────────────────────────────────────────────────────

CREATE TABLE "SourceInsight" (
    "id"          TEXT NOT NULL,
    "sourceId"    TEXT NOT NULL,
    "insightType" TEXT NOT NULL,
    "content"     TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceInsight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SourceInsight_sourceId_idx" ON "SourceInsight"("sourceId");

-- ─── Note ─────────────────────────────────────────────────────────────────────

CREATE TABLE "Note" (
    "id"        TEXT NOT NULL,
    "title"     TEXT,
    "content"   TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Note_deletedAt_idx" ON "Note"("deletedAt");

-- ─── ChatSession ──────────────────────────────────────────────────────────────

CREATE TABLE "ChatSession" (
    "id"         TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "title"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatSession_notebookId_idx" ON "ChatSession"("notebookId");

-- ─── ChatMessage ──────────────────────────────────────────────────────────────

CREATE TABLE "ChatMessage" (
    "id"            TEXT NOT NULL,
    "chatSessionId" TEXT NOT NULL,
    "role"          TEXT NOT NULL,
    "content"       TEXT NOT NULL,
    "citations"     JSONB,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatMessage_chatSessionId_idx" ON "ChatMessage"("chatSessionId");

-- ─── Join Tables ──────────────────────────────────────────────────────────────

CREATE TABLE "NotebookSource" (
    "notebookId" TEXT NOT NULL,
    "sourceId"   TEXT NOT NULL,

    CONSTRAINT "NotebookSource_pkey" PRIMARY KEY ("notebookId", "sourceId")
);

CREATE TABLE "NotebookNote" (
    "notebookId" TEXT NOT NULL,
    "noteId"     TEXT NOT NULL,

    CONSTRAINT "NotebookNote_pkey" PRIMARY KEY ("notebookId", "noteId")
);

-- ─── ApiKey ───────────────────────────────────────────────────────────────────

CREATE TABLE "ApiKey" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "keyHash"     TEXT NOT NULL,
    "keyPrefix"   TEXT NOT NULL,
    "scope"       "ApiScope" NOT NULL DEFAULT 'EXTERNAL',
    "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notebookIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "ownerId"     TEXT NOT NULL,
    "rateLimit"   INTEGER NOT NULL DEFAULT 100,
    "expiresAt"   TIMESTAMP(3),
    "lastUsedAt"  TIMESTAMP(3),
    "lastUsedIp"  TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt"   TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_keyPrefix_idx" ON "ApiKey"("keyPrefix");

-- ─── AuditLog ─────────────────────────────────────────────────────────────────

CREATE TABLE "AuditLog" (
    "id"        TEXT NOT NULL,
    "action"    TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId"   TEXT NOT NULL,
    "resource"  TEXT NOT NULL,
    "metadata"  JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_resource_idx" ON "AuditLog"("resource");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- ─── Credential ───────────────────────────────────────────────────────────────

CREATE TABLE "Credential" (
    "id"             TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "provider"       TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Credential_provider_name_key" ON "Credential"("provider", "name");

-- ─── Foreign Keys ─────────────────────────────────────────────────────────────

ALTER TABLE "SourceChunk" ADD CONSTRAINT "SourceChunk_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SourceInsight" ADD CONSTRAINT "SourceInsight_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_notebookId_fkey"
    FOREIGN KEY ("notebookId") REFERENCES "Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chatSessionId_fkey"
    FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotebookSource" ADD CONSTRAINT "NotebookSource_notebookId_fkey"
    FOREIGN KEY ("notebookId") REFERENCES "Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotebookSource" ADD CONSTRAINT "NotebookSource_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotebookNote" ADD CONSTRAINT "NotebookNote_notebookId_fkey"
    FOREIGN KEY ("notebookId") REFERENCES "Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotebookNote" ADD CONSTRAINT "NotebookNote_noteId_fkey"
    FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
