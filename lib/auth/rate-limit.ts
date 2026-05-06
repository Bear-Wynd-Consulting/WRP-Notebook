import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Shared rate limiting utility using Upstash Redis.
 *
 * Defaults to 100 requests per minute if not specified.
 * Returns null if UPSTASH_REDIS_REST_URL is not configured (dev mode).
 */

let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null;
  if (!ratelimit) {
    ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      prefix: "wrp_rl",
    });
  }
  return ratelimit;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check if a request should be rate limited.
 * @param identifier A unique identifier for the user or API key (e.g., user.id or apiKey.id)
 * @returns RateLimitResult or null if rate limiting is disabled
 */
export async function checkRateLimit(
  identifier: string
): Promise<RateLimitResult | null> {
  const rl = getRatelimit();
  if (!rl) return null;

  return await rl.limit(identifier);
}
