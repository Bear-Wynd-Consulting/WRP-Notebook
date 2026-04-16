-- WRP Notebook — Add databases array to Notebook for WRP data connection selection

ALTER TABLE "Notebook" ADD COLUMN IF NOT EXISTS "databases" TEXT[] NOT NULL DEFAULT '{}';
