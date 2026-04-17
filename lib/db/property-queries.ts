/**
 * Read-only query helpers for WRP property management data.
 *
 * These queries run through propertyDb — a Prisma client connected as
 * wrp_notebook_app, a PostgreSQL user with SELECT-only permissions.
 *
 * HOW TO COMPLETE THIS FILE
 * ─────────────────────────
 * 1. Run scripts/setup-readonly-role.sql in the Neon SQL Editor.
 * 2. Note which tables appear in Step 1's output (your existing tables).
 * 3. Run from your local machine:
 *      PROPERTY_DB_URL="postgresql://wrp_notebook_app:...@.../neondb?sslmode=require" \
 *      npx prisma db pull
 *    This introspects the live schema and prints Prisma model definitions.
 * 4. Copy the relevant model blocks into prisma/schema.prisma, adding
 *    a `// @readonly — managed by WRP Property Management app` comment.
 * 5. Run: npx prisma generate
 * 6. Replace the placeholder functions below with real Prisma calls.
 *
 * PATTERN: every function here must be read-only (findMany / findUnique / count).
 * Never import propertyDb in a route handler directly — always go through here.
 */
import { propertyDb } from "@/lib/db/property-client";
import { propertyDb as propertyNeon } from "@/lib/db/property-db";
import type { ContextChunk } from "@/lib/ai/safe-prompt";

// ─── Types ────────────────────────────────────────────────────────────────────
// Replace these with the actual generated Prisma types once you run prisma generate.
// Example (uncomment after adding models to schema.prisma):
//
// import type { Building, Tenant, Unit, Lease } from "@/app/generated/prisma/client";

// ─── Buildings ────────────────────────────────────────────────────────────────

/**
 * List all buildings visible to the notebook app.
 * Replace 'building' with your actual Prisma model name (lowercased).
 */
export async function getBuildings() {
  // TODO: replace with actual model name after running prisma db pull
  // return propertyDb.building.findMany({ orderBy: { name: "asc" } });
  throw new Error(
    "getBuildings: complete setup by running scripts/setup-readonly-role.sql and prisma db pull"
  );
}

/**
 * Get a single building by ID.
 */
export async function getBuildingById(id: string) {
  // TODO: replace with actual model name
  // return propertyDb.building.findUnique({ where: { id } });
  void id;
  throw new Error("getBuildingById: complete setup first");
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

/**
 * List tenants, optionally filtered by building.
 */
export async function getTenants(buildingId?: string) {
  // TODO: replace with actual model name and filter field
  // return propertyDb.tenant.findMany({
  //   where: buildingId ? { buildingId } : undefined,
  //   orderBy: { lastName: "asc" },
  // });
  void buildingId;
  throw new Error("getTenants: complete setup first");
}

/**
 * Get a single tenant by ID.
 */
export async function getTenantById(id: string) {
  // TODO:
  // return propertyDb.tenant.findUnique({ where: { id } });
  void id;
  throw new Error("getTenantById: complete setup first");
}

// ─── Units ────────────────────────────────────────────────────────────────────

/**
 * List units in a building.
 */
export async function getUnitsByBuilding(buildingId: string) {
  // TODO:
  // return propertyDb.unit.findMany({ where: { buildingId }, orderBy: { unitNumber: "asc" } });
  void buildingId;
  throw new Error("getUnitsByBuilding: complete setup first");
}

// ─── Context for AI Chat ─────────────────────────────────────────────────────

/**
 * Returns a structured summary of a building and its tenants, suitable
 * for injecting into the AI chat context so the model can answer questions
 * like "Who lives in Suite 204?" or "What's the lease expiry for Building A?"
 *
 * Called by the /api/v1/notebooks/[id]/ask and /chat routes when the
 * notebook is tagged with a buildingId.
 */
export async function getBuildingContextForAI(_buildingId: string): Promise<string> {
  // TODO: once models are in place, implement this like:
  //
  // const building = await getBuildingById(buildingId);
  // const units = await getUnitsByBuilding(buildingId);
  // return [
  //   `Building: ${building.name} (${building.address})`,
  //   `Units: ${units.length}`,
  //   units.map(u => `  Unit ${u.unitNumber}: ${u.tenant?.name ?? "Vacant"}`).join("\n"),
  // ].join("\n");
  throw new Error("getBuildingContextForAI: complete setup first");
}

// ─── Context chunks for AI chat ───────────────────────────────────────────────

type Row = Record<string, unknown>;

const ROW_LIMIT = 50;

const DB_QUERIES: Record<string, string> = {
  wrp_spaces:
    `SELECT id, name, type, status, building, floor, area_sqft FROM spaces ORDER BY building, floor LIMIT ${ROW_LIMIT}`,
  wrp_tenants:
    `SELECT id, company_name, space_id, lease_start, lease_end, contact_email FROM tenants ORDER BY company_name LIMIT ${ROW_LIMIT}`,
  wrp_maintenance:
    `SELECT id, space_id, type, status, reported_at, description FROM maintenance_requests ORDER BY reported_at DESC LIMIT ${ROW_LIMIT}`,
  wrp_inquiries:
    `SELECT id, company_name, inquiry_date, status, notes FROM inquiries ORDER BY inquiry_date DESC LIMIT ${ROW_LIMIT}`,
  wrp_communications:
    `SELECT id, recipient, subject, sent_at, status FROM communications ORDER BY sent_at DESC LIMIT ${ROW_LIMIT}`,
};

const DB_LABELS: Record<string, string> = {
  wrp_spaces: "WRP Spaces (available/occupied units)",
  wrp_tenants: "WRP Tenants (current lease holders)",
  wrp_maintenance: "WRP Maintenance Requests",
  wrp_inquiries: "WRP Inquiries (prospective tenants)",
  wrp_communications: "WRP Communications (outbound messages)",
};

/**
 * Fetch context chunks for the given list of enabled WRP database IDs.
 * Returns one ContextChunk per database, appended after source chunks in chat.
 * Safe when PROPERTY_DB_URL is unset — returns empty array.
 */
export async function fetchPropertyContext(
  databases: string[]
): Promise<ContextChunk[]> {
  if (!propertyNeon || databases.length === 0) return [];
  const db = propertyNeon; // narrowed non-null reference for async closures

  const results = await Promise.allSettled(
    databases
      .filter((id) => id in DB_QUERIES)
      .map(async (id): Promise<ContextChunk> => {
        let content: string;
        try {
          const rows = (await db.query(DB_QUERIES[id])) as Row[];
          content =
            rows.length === 0
              ? "(no records found)"
              : rows.map((r) => JSON.stringify(r)).join("\n");
        } catch (err) {
          content = `(query error: ${err instanceof Error ? err.message : "unknown"})`;
        }
        return {
          id: `prop_${id}`,
          sourceId: id,
          content: `${DB_LABELS[id] ?? id}:\n${content}`,
        };
      })
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<ContextChunk> => r.status === "fulfilled"
    )
    .map((r) => r.value);
}
