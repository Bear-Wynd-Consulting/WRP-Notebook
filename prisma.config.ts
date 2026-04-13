import { config as loadEnv } from "dotenv";
// Load .env.local first (local dev overrides), fall back to .env
loadEnv({ path: ".env.local" });
loadEnv();
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // DIRECT_URL is the non-pooler Neon endpoint — required for Prisma CLI / migrations.
  // At runtime the app uses DATABASE_URL (pooled) via PrismaNeon adapter in lib/db/client.ts.
  datasource: {
    url: process.env["DIRECT_URL"],
  },
});
