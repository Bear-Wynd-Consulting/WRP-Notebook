/**
 * API key authentication middleware for /api/v1/* routes.
 *
 * Extracts the bearer token, hashes it, looks up the key, validates state,
 * checks rate limits, and returns the ApiKeyContext for downstream authorization.
 */
import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { ApiKeyContext } from "@/lib/db/scoped-queries";
import { UnauthorizedError } from "@/lib/auth/authorize";
import { checkRateLimit } from "@/lib/auth/rate-limit";

// ─── Client IP ────────────────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ─── Main middleware function ─────────────────────────────────────────────────

/**
 * Authenticate an API request. Returns the ApiKeyContext on success.
 * Throws UnauthorizedError if the key is missing, invalid, revoked, or expired.
 */
export async function authenticateApiKey(
  req: NextRequest
): Promise<ApiKeyContext> {
  // 1. Extract bearer token
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    throw new UnauthorizedError("Missing API key");
  }

  // 2. Hash and lookup
  const hash = createHash("sha256").update(token).digest("hex");
  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash: hash } });

  if (!apiKey) {
    throw new UnauthorizedError("Invalid API key");
  }

  // 3. Validate key state
  if (apiKey.revokedAt) {
    throw new UnauthorizedError("API key has been revoked");
  }
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw new UnauthorizedError("API key has expired");
  }

  // 4. Rate limiting (skip if Upstash not configured — dev mode)
  const rlResult = await checkRateLimit(apiKey.id);
  if (rlResult && !rlResult.success) {
    const resetAt = new Date(rlResult.reset).toISOString();
    throw Object.assign(
      new UnauthorizedError(`Rate limit exceeded. Resets at ${resetAt}`),
      { statusOverride: 429 }
    );
  }

  // 5. Update usage metadata (fire-and-forget — never block the request)
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date(), lastUsedIp: getClientIp(req) },
    })
    .catch(() => {});

  // 6. Return context for downstream authorization
  return {
    id: apiKey.id,
    scope: apiKey.scope as "ADMIN" | "INTERNAL" | "EXTERNAL",
    permissions: apiKey.permissions,
    notebookIds: apiKey.notebookIds,
  };
}
