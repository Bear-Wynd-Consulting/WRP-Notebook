/**
 * Prisma client singleton with Neon serverless adapter.
 *
 * Prisma v7 requires a driver adapter. In production (Vercel + Neon),
 * we use the Neon HTTP adapter for serverless-compatible connection pooling.
 * In development, we reuse a single adapter instance to prevent pool exhaustion.
 *
 * IMPORTANT: Never import prisma directly in route handlers.
 * Use the scoped query wrappers in lib/db/scoped-queries.ts instead.
 *
 * The connection URL is configured via DATABASE_URL in prisma.config.ts.
 */
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";

// @prisma/adapter-neon talks Neon's wss:// edge proxy protocol, which the
// local Postgres container doesn't speak. LOCAL_POSTGRES routes it through
// the wsproxy sidecar (docker-compose.yml) instead, which translates that
// protocol to plain Postgres wire protocol. Never set in production.
if (process.env.LOCAL_POSTGRES === "true") {
  neonConfig.wsProxy = (host) => `${host}:80/v1`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineConnect = false;
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
