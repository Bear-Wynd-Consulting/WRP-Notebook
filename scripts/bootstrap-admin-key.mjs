#!/usr/bin/env node
/**
 * Bootstrap Admin Key Generator
 *
 * Generates a WRP API key with ADMIN scope and prints:
 *  - The plaintext key  (copy this — it will never appear again)
 *  - A ready-to-run SQL INSERT for Neon SQL Editor
 *
 * Usage:
 *   node scripts/bootstrap-admin-key.mjs
 *   node scripts/bootstrap-admin-key.mjs "My Key Name"
 *
 * No dependencies — uses only Node.js built-ins.
 */

import { createHash, randomBytes } from "node:crypto";

const name = process.argv[2] ?? "Bootstrap Admin Key";

// ─── Generate key (mirrors lib/auth/api-keys.ts) ──────────────────────────────
const raw = randomBytes(32).toString("base64url"); // 256-bit entropy
const key = `wrp_k1_${raw}`;
const hash = createHash("sha256").update(key).digest("hex");
const prefix = key.slice(0, 12);
const id = randomBytes(12).toString("hex"); // cuid-like unique ID for the row

// ─── Output ────────────────────────────────────────────────────────────────────
const divider = "─".repeat(70);

console.log(`\n${divider}`);
console.log("  WRP Knowledge Hub — Admin Key Bootstrap");
console.log(divider);
console.log();
console.log("  STEP 1 — Copy your API key NOW.");
console.log("  This is the only time the plaintext key will be shown.");
console.log();
console.log(`  Key:    ${key}`);
console.log();
console.log(divider);
console.log();
console.log("  STEP 2 — Run the SQL below in Neon SQL Editor.");
console.log("  Dashboard → your project → SQL Editor → paste and run.");
console.log();

const sql = `INSERT INTO "ApiKey" (
  id,
  name,
  "keyHash",
  "keyPrefix",
  scope,
  permissions,
  "notebookIds",
  "ownerId",
  "rateLimit",
  "createdAt"
) VALUES (
  '${id}',
  '${name.replace(/'/g, "''")}',
  '${hash}',
  '${prefix}',
  'ADMIN',
  '{}',
  '{}',
  'system',
  1000,
  NOW()
);`;

console.log(sql);
console.log();
console.log(divider);
console.log();
console.log("  STEP 3 — Verify the insert worked.");
console.log();
console.log(`  SELECT id, name, "keyPrefix", scope FROM "ApiKey" WHERE id = '${id}';`);
console.log();
console.log("  STEP 4 — Test the key.");
console.log();
console.log(`  curl https://wrp-notebook.vercel.app/api/v1/health \\`);
console.log(`    -H "Authorization: Bearer ${key}"`);
console.log();
console.log(divider);
console.log();
console.log("  Security reminders:");
console.log("  • Store the key in a password manager or Vercel env var immediately.");
console.log("  • Do NOT commit it to git.");
console.log("  • If lost, run this script again to generate a new key.");
console.log(`${divider}\n`);
