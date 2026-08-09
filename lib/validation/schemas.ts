/**
 * Zod validation schemas for all API inputs.
 *
 * Every API route must validate its request body/params against one of these
 * schemas before processing. Never access req.body without validation.
 */
import { z } from "zod";
import { contractFieldsSchema } from "./contract-schema";

// ─── Notebooks ────────────────────────────────────────────────────────────────

export const createNotebookSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().optional(),
  visibility: z.enum(["PRIVATE", "INTERNAL", "PUBLIC"]).default("PRIVATE"),
});

export const updateNotebookSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).trim().optional(),
  visibility: z.enum(["PRIVATE", "INTERNAL", "PUBLIC"]).optional(),
});

// ─── Sources ──────────────────────────────────────────────────────────────────

export const createSourceSchema = z.object({
  type: z.enum(["pdf", "url", "youtube", "audio", "text"]),
  title: z.string().max(500).trim().optional(),
  url: z.string().url().max(2048).optional(),
  text: z.string().max(500_000).optional(), // ~125k tokens max
});

/** Two-phase PDF commit: confirmed Editor.js data + document metadata */
export const commitSourceSchema = z
  .object({
    notebookId: z.string().min(1),
    metadata: z.object({
      department: z.string().max(200).trim().optional().default(""),
      useCase: z.string().max(500).trim().optional().default(""),
      date: z.string().max(20).trim().optional().default(""),
    }),
    isContract: z.boolean().optional().default(false),
    contractFields: contractFieldsSchema.optional(),
    structuredData: z.object({
      time: z.number(),
      blocks: z.array(
        z.object({
          type: z.string(),
          data: z.record(z.string(), z.unknown()),
        })
      ),
      version: z.string().optional(),
    }),
    rawText: z.string().max(500_000),
  })
  .refine((data) => !data.isContract || !!data.contractFields, {
    message: "contractFields is required when isContract is true",
    path: ["contractFields"],
  });

// ─── Notes ────────────────────────────────────────────────────────────────────

export const createNoteSchema = z.object({
  title: z.string().max(500).trim().optional(),
  content: z.string().min(1).max(100_000).trim(),
});

export const updateNoteSchema = z.object({
  title: z.string().max(500).trim().optional(),
  content: z.string().min(1).max(100_000).trim().optional(),
});

// ─── Chat / Ask ───────────────────────────────────────────────────────────────

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(5000).trim(),
  sessionId: z.string().cuid().optional(), // if null, creates a new session
});

export const askSchema = z.object({
  question: z.string().min(1).max(5000).trim(),
  maxSources: z.number().int().min(1).max(20).default(5),
});

// ─── Search ───────────────────────────────────────────────────────────────────

export const searchSchema = z.object({
  query: z.string().min(1).max(1000).trim(),
  limit: z.number().int().min(1).max(50).default(10),
  offset: z.number().int().min(0).default(0),
});

// ─── API Keys (Admin) ─────────────────────────────────────────────────────────

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  scope: z.enum(["ADMIN", "INTERNAL", "EXTERNAL"]).default("EXTERNAL"),
  permissions: z.array(z.string()).default([]),
  notebookIds: z.array(z.string().cuid()).default([]),
  rateLimit: z.number().int().min(1).max(10_000).default(100),
  expiresAt: z.string().datetime().optional(),
});

/** Notebook-scoped key creation from the notebook detail page — admin session only. */
export const createNotebookApiKeySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  scope: z.enum(["INTERNAL", "EXTERNAL"]).default("EXTERNAL"),
  rateLimit: z.number().int().min(1).max(10_000).default(100),
  expiresAt: z.string().datetime().optional(),
});

// ─── Pagination ───────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
