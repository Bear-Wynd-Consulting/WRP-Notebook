/**
 * One-time migration: move all notebook tables from public → notebook schema.
 * Run AFTER Neon PITR restore and BEFORE updating DATABASE_URL search_path.
 *
 * Usage: npx tsx scripts/migrate-to-notebook-schema.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DIRECT_URL!);

async function move(label: string, query: ReturnType<typeof sql>) {
  try {
    await query;
    console.log(`  ✓ ${label}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist")) {
      console.log(`  - ${label} (not found, skipping)`);
    } else {
      throw err;
    }
  }
}

async function run() {
  console.log("Connecting to:", process.env.DIRECT_URL?.replace(/:([^@]+)@/, ":***@"));

  // B1 — Create notebook schema
  console.log("\n[B1] Creating notebook schema...");
  await sql`CREATE SCHEMA IF NOT EXISTS notebook`;
  await sql`GRANT ALL ON SCHEMA notebook TO neondb_owner`;
  console.log("  ✓ notebook schema created");

  // B2 — Move tables
  console.log("\n[B2] Moving tables to notebook schema...");
  await move("Notebook",        sql`ALTER TABLE public."Notebook"       SET SCHEMA notebook`);
  await move("Source",          sql`ALTER TABLE public."Source"         SET SCHEMA notebook`);
  await move("SourceChunk",     sql`ALTER TABLE public."SourceChunk"    SET SCHEMA notebook`);
  await move("SourceInsight",   sql`ALTER TABLE public."SourceInsight"  SET SCHEMA notebook`);
  await move("Note",            sql`ALTER TABLE public."Note"           SET SCHEMA notebook`);
  await move("ChatSession",     sql`ALTER TABLE public."ChatSession"    SET SCHEMA notebook`);
  await move("ChatMessage",     sql`ALTER TABLE public."ChatMessage"    SET SCHEMA notebook`);
  await move("NotebookSource",  sql`ALTER TABLE public."NotebookSource" SET SCHEMA notebook`);
  await move("NotebookNote",    sql`ALTER TABLE public."NotebookNote"   SET SCHEMA notebook`);
  await move("ApiKey",          sql`ALTER TABLE public."ApiKey"         SET SCHEMA notebook`);
  await move("AuditLog",        sql`ALTER TABLE public."AuditLog"       SET SCHEMA notebook`);
  await move("Credential",      sql`ALTER TABLE public."Credential"     SET SCHEMA notebook`);
  await move("User",            sql`ALTER TABLE public."User"           SET SCHEMA notebook`);
  await move("Building",        sql`ALTER TABLE public."Building"       SET SCHEMA notebook`);
  await move("Unit",            sql`ALTER TABLE public."Unit"           SET SCHEMA notebook`);
  await move("Tenant",          sql`ALTER TABLE public."Tenant"         SET SCHEMA notebook`);

  // B3 — Move enums
  console.log("\n[B3] Moving enums...");
  await move("Visibility",    sql`ALTER TYPE public."Visibility"   SET SCHEMA notebook`);
  await move("ApiScope",      sql`ALTER TYPE public."ApiScope"     SET SCHEMA notebook`);
  await move("SourceStatus",  sql`ALTER TYPE public."SourceStatus" SET SCHEMA notebook`);
  // _prisma_migrations already in notebook from previous run — skip
  console.log("  - _prisma_migrations (already in notebook schema)");

  // B4 — Verify
  console.log("\n[B4] Verifying...");
  const notebookTables = await sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'notebook' ORDER BY tablename
  `;
  console.log(`  notebook schema has ${notebookTables.length} tables:`);
  notebookTables.forEach((r) => console.log(`    - ${r.tablename}`));

  const publicNotebook = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
      'Notebook','Source','SourceChunk','SourceInsight','Note',
      'ChatSession','ChatMessage','NotebookSource','NotebookNote',
      'ApiKey','AuditLog','Credential','User','Building','Unit','Tenant'
    )
  `;
  if (publicNotebook.length === 0) {
    console.log("\n  ✅ No notebook tables remain in public schema.");
  } else {
    console.log(`\n  ⚠️  ${publicNotebook.length} notebook tables still in public:`);
    publicNotebook.forEach((r) => console.log(`    - ${r.tablename}`));
  }

  // Check property tables still in public
  const propTables = await sql`
    SELECT count(*) AS cnt FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN ('spaces', 'tenants')
  `;
  console.log(`\n  Property tables in public: ${propTables[0].cnt}/2 (expect 2)`);

  console.log("\n✅ Migration complete.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
