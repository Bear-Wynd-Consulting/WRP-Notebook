/**
 * pgvector semantic search and full-text search.
 *
 * SECURITY: All queries use parameterized placeholders via Prisma $queryRaw.
 * NEVER interpolate user input into SQL strings.
 */
import { prisma } from "./client";
import { AI_LIMITS } from "@/lib/ai/cost-guard";

export interface VectorSearchResult {
  id: string;
  sourceId: string;
  content: string;
  similarity: number;
}

/**
 * Semantic vector search within a specific notebook.
 * Uses pgvector cosine distance on SourceChunk.embedding.
 */
export async function vectorSearchInNotebook(
  notebookId: string,
  embedding: number[],
  limit = 10
): Promise<VectorSearchResult[]> {
  const safeLimit = Math.min(limit, AI_LIMITS.MAX_CONTEXT_CHUNKS);

  // Safe: uses parameterized placeholders — no user input interpolated
  const results = await prisma.$queryRaw<VectorSearchResult[]>`
    SELECT
      sc.id,
      sc."sourceId",
      sc.content,
      1 - (sc.embedding <=> ${embedding}::vector) AS similarity
    FROM "SourceChunk" sc
    JOIN "NotebookSource" ns ON ns."sourceId" = sc."sourceId"
    WHERE ns."notebookId" = ${notebookId}
      AND sc.embedding IS NOT NULL
    ORDER BY sc.embedding <=> ${embedding}::vector
    LIMIT ${safeLimit}
  `;

  return results;
}

/**
 * Full-text search within a notebook using PostgreSQL tsvector.
 */
export async function fullTextSearchInNotebook(
  notebookId: string,
  query: string,
  limit = 10
): Promise<VectorSearchResult[]> {
  const safeLimit = Math.min(limit, AI_LIMITS.MAX_CONTEXT_CHUNKS);

  const results = await prisma.$queryRaw<VectorSearchResult[]>`
    SELECT
      sc.id,
      sc."sourceId",
      sc.content,
      ts_rank(to_tsvector('english', sc.content), plainto_tsquery('english', ${query})) AS similarity
    FROM "SourceChunk" sc
    JOIN "NotebookSource" ns ON ns."sourceId" = sc."sourceId"
    WHERE ns."notebookId" = ${notebookId}
      AND to_tsvector('english', sc.content) @@ plainto_tsquery('english', ${query})
    ORDER BY similarity DESC
    LIMIT ${safeLimit}
  `;

  return results;
}

/**
 * Hybrid search: combine vector and full-text results, deduplicate, rank by similarity.
 */
export async function hybridSearchInNotebook(
  notebookId: string,
  query: string,
  embedding: number[],
  limit = 10
): Promise<VectorSearchResult[]> {
  const [vectorResults, textResults] = await Promise.all([
    vectorSearchInNotebook(notebookId, embedding, limit),
    fullTextSearchInNotebook(notebookId, query, limit),
  ]);

  // Merge and deduplicate by chunk id, prefer higher similarity score
  const seen = new Map<string, VectorSearchResult>();
  for (const result of [...vectorResults, ...textResults]) {
    const existing = seen.get(result.id);
    if (!existing || result.similarity > existing.similarity) {
      seen.set(result.id, result);
    }
  }

  return Array.from(seen.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
