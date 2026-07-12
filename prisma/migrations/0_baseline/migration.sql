
-- Enable pgvector (required for SourceChunk.embedding vector type)
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "notebook";

-- CreateEnum
CREATE TYPE "notebook"."ApiScope" AS ENUM ('ADMIN', 'INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "notebook"."SourceStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERROR');

-- CreateEnum
CREATE TYPE "notebook"."Visibility" AS ENUM ('PRIVATE', 'INTERNAL', 'PUBLIC');

-- CreateTable
CREATE TABLE "notebook"."ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "scope" "notebook"."ApiScope" NOT NULL DEFAULT 'EXTERNAL',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notebookIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ownerId" TEXT NOT NULL,
    "rateLimit" INTEGER NOT NULL DEFAULT 100,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "lastUsedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notebook"."AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notebook"."ChatMessage" (
    "id" TEXT NOT NULL,
    "chatSessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notebook"."ChatSession" (
    "id" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notebook"."Credential" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notebook"."Note" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notebook"."Notebook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "notebook"."Visibility" NOT NULL DEFAULT 'PRIVATE',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "databases" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Notebook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notebook"."NotebookNote" (
    "notebookId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,

    CONSTRAINT "NotebookNote_pkey" PRIMARY KEY ("notebookId","noteId")
);

-- CreateTable
CREATE TABLE "notebook"."NotebookSource" (
    "notebookId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "NotebookSource_pkey" PRIMARY KEY ("notebookId","sourceId")
);

-- CreateTable
CREATE TABLE "notebook"."Source" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "summary" TEXT,
    "metadata" JSONB,
    "status" "notebook"."SourceStatus" NOT NULL DEFAULT 'PENDING',
    "filePath" TEXT,
    "blobUrl" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notebook"."SourceChunk" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector,
    "chunkIndex" INTEGER NOT NULL,

    CONSTRAINT "SourceChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notebook"."SourceInsight" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "insightType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notebook"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiKey_keyHash_idx" ON "notebook"."ApiKey"("keyHash" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "notebook"."ApiKey"("keyHash" ASC);

-- CreateIndex
CREATE INDEX "ApiKey_keyPrefix_idx" ON "notebook"."ApiKey"("keyPrefix" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "notebook"."AuditLog"("actorId" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "notebook"."AuditLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_resource_idx" ON "notebook"."AuditLog"("resource" ASC);

-- CreateIndex
CREATE INDEX "ChatMessage_chatSessionId_idx" ON "notebook"."ChatMessage"("chatSessionId" ASC);

-- CreateIndex
CREATE INDEX "ChatSession_notebookId_idx" ON "notebook"."ChatSession"("notebookId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Credential_provider_name_key" ON "notebook"."Credential"("provider" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "Note_deletedAt_idx" ON "notebook"."Note"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "Notebook_deletedAt_idx" ON "notebook"."Notebook"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "Notebook_ownerId_idx" ON "notebook"."Notebook"("ownerId" ASC);

-- CreateIndex
CREATE INDEX "Notebook_visibility_idx" ON "notebook"."Notebook"("visibility" ASC);

-- CreateIndex
CREATE INDEX "SourceChunk_sourceId_idx" ON "notebook"."SourceChunk"("sourceId" ASC);

-- CreateIndex
CREATE INDEX "SourceInsight_sourceId_idx" ON "notebook"."SourceInsight"("sourceId" ASC);

-- CreateIndex
CREATE INDEX "User_email_idx" ON "notebook"."User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "notebook"."User"("email" ASC);

-- AddForeignKey
ALTER TABLE "notebook"."ChatMessage" ADD CONSTRAINT "ChatMessage_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "notebook"."ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notebook"."ChatSession" ADD CONSTRAINT "ChatSession_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "notebook"."Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notebook"."NotebookNote" ADD CONSTRAINT "NotebookNote_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notebook"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notebook"."NotebookNote" ADD CONSTRAINT "NotebookNote_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "notebook"."Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notebook"."NotebookSource" ADD CONSTRAINT "NotebookSource_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "notebook"."Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notebook"."NotebookSource" ADD CONSTRAINT "NotebookSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "notebook"."Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notebook"."SourceChunk" ADD CONSTRAINT "SourceChunk_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "notebook"."Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notebook"."SourceInsight" ADD CONSTRAINT "SourceInsight_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "notebook"."Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;


