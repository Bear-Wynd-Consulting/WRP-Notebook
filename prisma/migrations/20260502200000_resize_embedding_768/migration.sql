-- Resize SourceChunk.embedding from vector(1536) to vector(768).
-- pgvector cannot ALTER column in place; drop and re-add is required.
-- Any stored embeddings (NULL only at this stage) are lost — re-embed after apply.
ALTER TABLE "notebook"."SourceChunk" DROP COLUMN "embedding";
ALTER TABLE "notebook"."SourceChunk" ADD COLUMN "embedding" vector(768);
