/**
 * API key generation and verification.
 *
 * Keys are versioned (wrp_k1_ prefix), 256-bit entropy, SHA-256 hashed at rest.
 * The plaintext key is returned exactly once at creation and never stored.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";

const KEY_PREFIX = "wrp_k1_";

export interface GeneratedApiKey {
  /** Full key — return to user ONCE, then discard */
  key: string;
  /** SHA-256 hash — store in database */
  hash: string;
  /** First 12 chars — for UI display / identification */
  prefix: string;
}

/** Generate a new API key. Store only `hash` and `prefix` in the database. */
export function generateApiKey(): GeneratedApiKey {
  const raw = randomBytes(32).toString("base64url"); // 256-bit entropy
  const key = `${KEY_PREFIX}${raw}`;
  const hash = hashApiKey(key);
  const prefix = key.slice(0, 12);
  return { key, hash, prefix };
}

/** Hash an API key for database storage/lookup. */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Timing-safe comparison of a candidate key against a stored hash.
 * Prevents timing attacks that could enumerate valid key prefixes.
 */
export function verifyApiKey(candidate: string, storedHash: string): boolean {
  const candidateHash = hashApiKey(candidate);
  const a = Buffer.from(candidateHash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
