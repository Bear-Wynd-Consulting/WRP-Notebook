/**
 * Read-only Prisma client for WRP property management tables.
 *
 * Uses a dedicated PostgreSQL user (wrp_notebook_app) that has ONLY SELECT
 * permissions on property management tables. Any attempt to write through
 * this client will fail at the database level — not just in application code.
 *
 * Connection string: PROPERTY_DB_URL (set in Vercel env vars)
 * This is a direct (non-pooler) Neon connection — fine for read-only workloads.
 *
 * To add new property management tables to the Prisma schema:
 *   1. Run: npx prisma db pull --schema=prisma/property-schema.prisma
 *      (point PROPERTY_DB_URL at your read-only user)
 *   2. Copy the new model definitions into prisma/schema.prisma
 *   3. Mark them with // @readonly in a comment so future developers know
 *      not to create migrations for them.
 *   4. Run: npx prisma generate
 */
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

function createPropertyClient() {
  const connectionString = process.env.PROPERTY_DB_URL;
  if (!connectionString) {
    throw new Error(
      "PROPERTY_DB_URL is not set. Add the read-only Neon connection string to your environment variables."
    );
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForProperty = globalThis as unknown as {
  propertyDb: PrismaClient | undefined;
};

/**
 * Lazy accessor — the client is created on first call, not at import time.
 * This prevents build-time crashes when PROPERTY_DB_URL isn't set yet.
 */
export function getPropertyDb(): PrismaClient {
  if (!globalForProperty.propertyDb) {
    globalForProperty.propertyDb = createPropertyClient();
  }
  return globalForProperty.propertyDb;
}
