/**
 * Read-only Neon client for WRP property management tables.
 *
 * Uses PROPERTY_DB_URL which must point to a Neon connection string
 * where the wrp_notebook_app role has SELECT-only permissions.
 * (Run scripts/setup-readonly-role.sql in Neon SQL Editor first.)
 *
 * If PROPERTY_DB_URL is unset, all property queries are skipped gracefully.
 */
import { neon } from "@neondatabase/serverless";

// Exported as null when unconfigured — callers must guard with `if (propertyDb)`
export const propertyDb = process.env.PROPERTY_DB_URL
  ? neon(process.env.PROPERTY_DB_URL)
  : null;
