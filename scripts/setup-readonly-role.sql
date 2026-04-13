-- ============================================================
-- WRP Notebook — Read-Only Role Setup
-- Run this ONCE in the Neon SQL Editor (neon.tech → project → SQL Editor)
-- ============================================================

-- ─── Step 1: See what property management tables already exist ────────────────
-- Run this first so you know what to grant access to.

SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name NOT IN (
    -- Exclude WRP Notebook's own tables (we'll create these separately)
    'Notebook', 'Source', 'SourceChunk', 'SourceInsight', 'Note',
    'ChatSession', 'ChatMessage', 'NotebookSource', 'NotebookNote',
    'ApiKey', 'AuditLog', 'Credential'
  )
ORDER BY table_name;

-- ─── Step 2: Create the read-only role ───────────────────────────────────────
-- This role has SELECT on property management tables ONLY.
-- The WRP Notebook app uses this role — it physically cannot INSERT/UPDATE/DELETE
-- property management data.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'wrp_notebook_ro') THEN
    CREATE ROLE wrp_notebook_ro;
  END IF;
END
$$;

-- Allow connection to the database
GRANT CONNECT ON DATABASE neondb TO wrp_notebook_ro;

-- Allow reading from the public schema
GRANT USAGE ON SCHEMA public TO wrp_notebook_ro;

-- ─── Step 3: Grant SELECT on existing property management tables ──────────────
-- Replace the table list below with the actual tables from Step 1's output.
-- Common WRP property management tables (update to match your actual schema):

GRANT SELECT ON TABLE
  -- tenants,
  -- buildings,
  -- units,
  -- leases,
  -- contacts,
  -- properties
  -- ... add your actual table names here
TO wrp_notebook_ro;

-- Also grant SELECT on any FUTURE tables added to the property management schema.
-- This means you won't need to re-run GRANT when new tables are added.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO wrp_notebook_ro;

-- ─── Step 4: Create a dedicated login user with the read-only role ────────────
-- Replace 'CHANGE_ME_STRONG_PASSWORD' with a real password.
-- Save the password — you'll add it to Vercel as PROPERTY_DB_URL.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'wrp_notebook_app') THEN
    CREATE USER wrp_notebook_app WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
  END IF;
END
$$;

GRANT wrp_notebook_ro TO wrp_notebook_app;

-- ─── Step 5: Verify the grants ───────────────────────────────────────────────
-- Run this to confirm wrp_notebook_app can only SELECT on property tables.

SELECT
    grantee,
    table_name,
    privilege_type
FROM information_schema.role_table_grants
WHERE grantee IN ('wrp_notebook_ro', 'wrp_notebook_app')
ORDER BY table_name, privilege_type;

-- ─── After running this script ───────────────────────────────────────────────
-- Your PROPERTY_DB_URL for the notebook app will be:
--
--   postgresql://wrp_notebook_app:CHANGE_ME_STRONG_PASSWORD@<your-neon-host>/neondb?sslmode=require
--
-- Use the NON-POOLER host for the read-only client (direct connection).
-- It looks like: ep-green-wildflower-amyigtm1.c-5.us-east-1.aws.neon.tech
-- (remove "-pooler" from the hostname you already have)
