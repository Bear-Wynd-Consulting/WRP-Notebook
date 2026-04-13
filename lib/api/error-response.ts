/**
 * Generic error response envelope.
 *
 * Never include stack traces, SQL fragments, or Prisma error details
 * in responses to API consumers. Log full errors server-side only.
 *
 * Standard response shape: { error: string, code: string }
 */

import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  UnauthorizedError,
} from "@/lib/auth/authorize";

export interface ApiErrorBody {
  error: string;
  code: string;
}

/** Build a standardised error Response. */
export function apiError(
  message: string,
  code: string,
  status: number
): Response {
  const body: ApiErrorBody = { error: message, code };
  return Response.json(body, { status });
}

/**
 * Map a thrown error to the appropriate HTTP response.
 * Always logs the full error server-side before returning a safe message.
 */
export function handleApiError(err: unknown, context?: string): Response {
  // Log full error server-side
  console.error(`API error${context ? ` [${context}]` : ""}:`, err);

  if (err instanceof UnauthorizedError) {
    return apiError(err.message, err.code, 401);
  }
  if (err instanceof ForbiddenError) {
    return apiError("Access denied", err.code, 403);
  }
  if (err instanceof NotFoundError) {
    return apiError("Resource not found", err.code, 404);
  }
  if (err instanceof ValidationError) {
    return apiError(err.message, err.code, 400);
  }

  // Generic catch-all — never leak internal details
  return apiError("Internal server error", "INTERNAL_ERROR", 500);
}
