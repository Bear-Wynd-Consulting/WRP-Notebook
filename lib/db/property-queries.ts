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
import { getPropertyDb } from "@/lib/db/property-client";

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
