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
// import type { Building, Tenant, Unit } from "@/app/generated/prisma/client";

// ─── Buildings ────────────────────────────────────────────────────────────────

/**
 * List all buildings visible to the notebook app.
 */
export async function getBuildings() {
  if (!propertyDb) return [];
  return propertyDb.building.findMany({ orderBy: { name: "asc" } });
}

/**
 * Get a single building by ID.
 */
export async function getBuildingById(id: string) {
  if (!propertyDb) return null;
  return propertyDb.building.findUnique({ where: { id } });
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

/**
 * List tenants, optionally filtered by building.
 */
export async function getTenants(buildingId?: string) {
  if (!propertyDb) return [];
  return propertyDb.tenant.findMany({
    where: buildingId ? { buildingId } : undefined,
    orderBy: { lastName: "asc" },
  });
}

/**
 * Get a single tenant by ID.
 */
export async function getTenantById(id: string) {
  if (!propertyDb) return null;
  return propertyDb.tenant.findUnique({ where: { id } });
}

// ─── Units ────────────────────────────────────────────────────────────────────

/**
 * List units in a building.
 */
export async function getUnitsByBuilding(buildingId: string) {
  if (!propertyDb) return [];
  return propertyDb.unit.findMany({
    where: { buildingId },
    orderBy: { unitNumber: "asc" },
    include: { tenant: true },
  });
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
export async function getBuildingContextForAI(buildingId: string): Promise<string> {
  if (!propertyDb) return "";

  const building = await getBuildingById(buildingId);
  if (!building) return "Building not found.";

  const units = await getUnitsByBuilding(buildingId);

  return [
    `Building: ${building.name} (${building.address ?? "No address"})`,
    `Units: ${units.length}`,
    units
      .map((u) => `  Unit ${u.unitNumber}: ${u.tenant?.name ?? "Vacant"}`)
      .join("\n"),
  ].join("\n");
}

// ─── Context chunks for AI chat ───────────────────────────────────────────────

type Row = Record<string, unknown>;

const DB_QUERIES: Record<string, string> = {
  wrp_spaces:
    `SELECT unit_number, building, floor, sqft, monthly_rent, status, space_type, capacity,
            (SELECT count(*) FROM spaces) AS total_spaces,
            (SELECT count(*) FROM spaces WHERE status = 'occupied') AS occupied_count,
            (SELECT count(*) FROM spaces WHERE status = 'available') AS available_count
     FROM spaces ORDER BY building, floor LIMIT 10`,
  wrp_tenants:
    `SELECT first_name, last_name, company, space_id, lease_start, lease_end, status, contact_role,
            (SELECT count(*) FROM tenants) AS total_tenants,
            (SELECT count(*) FROM tenants WHERE status = 'active') AS active_tenants
     FROM tenants ORDER BY last_name LIMIT 10`,
  wrp_maintenance:
    `SELECT * FROM maintenance_tickets ORDER BY created_at DESC LIMIT 5`,
  wrp_inquiries:
    `SELECT * FROM inquiry_sessions ORDER BY created_at DESC LIMIT 5`,
  wrp_leads:
    `SELECT * FROM leads ORDER BY created_at DESC LIMIT 5`,
  wrp_communications:
    `SELECT * FROM automated_reply_rules LIMIT 5`,
};

const DB_LABELS: Record<string, string> = {
  wrp_spaces: "WRP Spaces (available/occupied units)",
  wrp_tenants: "WRP Tenants (current lease holders)",
  wrp_maintenance: "WRP Maintenance Tickets",
  wrp_inquiries: "WRP Inquiry Sessions (prospective tenants)",
  wrp_leads: "WRP Leads (prospective tenant pipeline)",
  wrp_communications: "WRP Automated Reply Rules",
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
