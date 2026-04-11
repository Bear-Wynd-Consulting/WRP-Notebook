/**
 * SSRF protection for URL-based source ingestion.
 *
 * Validates that a submitted URL:
 *  1. Uses HTTP or HTTPS only
 *  2. Does not point to a private/reserved hostname
 *  3. Does not resolve to a private network IP (after DNS lookup)
 */
import dns from "dns/promises";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "169.254.169.254", // AWS/GCP metadata endpoint
]);

// Private/reserved IPv4 ranges
const BLOCKED_IP_PREFIXES = [
  "10.",
  "192.168.",
  "169.254.", // link-local
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
  "100.64.", // CGNAT
];

function isPrivateIp(addr: string): boolean {
  return BLOCKED_IP_PREFIXES.some((prefix) => addr.startsWith(prefix));
}

/**
 * Validate and return a parsed URL safe to fetch from.
 * Throws ValidationError with a safe message if the URL is not allowed.
 */
export async function validateIngestUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL format");
  }

  // Block non-HTTP(S) schemes
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are allowed");
  }

  // Block private/reserved hostnames by name
  if (BLOCKED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("URL points to a restricted host");
  }

  // DNS resolution check — block private IPs after resolution
  let addresses: string[] = [];
  try {
    addresses = await dns.resolve4(url.hostname);
  } catch {
    // If DNS fails, we reject (fail-closed)
    throw new Error("Could not resolve URL hostname");
  }

  for (const addr of addresses) {
    if (isPrivateIp(addr)) {
      throw new Error("URL resolves to a private network address");
    }
    if (BLOCKED_HOSTS.has(addr)) {
      throw new Error("URL resolves to a restricted address");
    }
  }

  return url;
}
