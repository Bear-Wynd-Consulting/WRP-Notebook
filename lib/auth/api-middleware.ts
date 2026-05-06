/**
 * API key authentication middleware for /api/v1/* routes.
 *
 * Extracts the bearer token, hashes it, looks up the key, validates state,
 * checks rate limits, and returns the ApiKeyContext for downstream authorization.
 */
import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { prisma } from "@/lib/db/client";
import { ApiKeyContext } from "@/lib/db/scoped-queries";
import { UnauthorizedError } from "@/lib/auth/authorize";

// ─── Cache ───────────────────────────────────────────────────────────────────

// Simple in-memory cache for API key lookups to reduce DB load.
// TTL: 5 minutes. Max size: 1000 entries.
type CachedApiKey = Awaited<ReturnType<typeof prisma.apiKey.findUnique>>;
const apiKeyCache = new Map<string, { data: CachedApiKey; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;

function getCachedApiKey(hash: string): CachedApiKey | undefined {
  const cached = apiKeyCache.get(hash);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  if (cached) {
    apiKeyCache.delete(hash);
  }
  return undefined;
}

function setCachedApiKey(hash: string, apiKey: CachedApiKey): void {
  // Basic LRU-ish eviction: if cache is full, clear it and start over.
  // Better would be true LRU, but for this scale, this is simple and safe.
  if (apiKeyCache.size >= MAX_CACHE_SIZE) {
    apiKeyCache.clear();
  }
  apiKeyCache.set(hash, {
    data: apiKey,
    expires: Date.now() + CACHE_TTL,
  });
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null;
  if (!ratelimit) {
    ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(100, "1 m"), // default — overridden per key
      prefix: "wrp_rl",
    });
  }
  return ratelimit;
}

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

  let apiKey = getCachedApiKey(hash);

  if (apiKey === undefined) {
    apiKey = await prisma.apiKey.findUnique({ where: { keyHash: hash } });
    setCachedApiKey(hash, apiKey);
  }

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
  const rl = getRatelimit();
  if (rl) {
    const { success, reset } = await rl.limit(apiKey.id);
    if (!success) {
      const resetAt = new Date(reset).toISOString();
      throw Object.assign(
        new UnauthorizedError(`Rate limit exceeded. Resets at ${resetAt}`),
        { statusOverride: 429 }
      );
    }
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
