/**
 * Row-level authorization — IDOR prevention.
 *
 * Every API route that accesses a notebook must call authorizeNotebookAccess()
 * before returning any data. This enforces scope and per-key notebook restrictions.
 */
import { ApiKeyContext } from "@/lib/db/scoped-queries";
import { getNotebookForApiKey } from "@/lib/db/scoped-queries";

export class NotFoundError extends Error {
  readonly code = "NOT_FOUND";
}

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
}

export class ValidationError extends Error {
  readonly code = "VALIDATION_ERROR";
}

export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED";
}

/**
 * Assert that the requesting API key context may access the given notebook.
 * Throws ForbiddenError or NotFoundError if not — never leaks "exists but forbidden".
 */
export async function authorizeNotebookAccess(
  notebookId: string,
  ctx: ApiKeyContext
) {
  const notebook = await getNotebookForApiKey(notebookId, ctx);

  if (!notebook) {
    // Return 404 even if the notebook exists but is inaccessible — prevent enumeration
    throw new NotFoundError("Notebook not found");
  }

  return notebook;
}
