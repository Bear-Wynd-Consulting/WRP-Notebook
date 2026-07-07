# WRP Knowledge Hub

A knowledge management platform built for Western Research Parks. Provides a public REST API for integration with WRP's property tour app, property management app, and website. Staff manage notebooks and sources through a browser-based dashboard; external systems access content through scoped API keys.

Forked from [open-notebook](https://github.com/lfnovo/open-notebook) (MIT). Rebuilt in TypeScript for a fully serverless stack on Vercel + Neon.

**Production:** https://wrp-notebook.vercel.app

---

## Contents

- [Tech Stack](#tech-stack)
- [Required Services & API Keys](#required-services--api-keys)
- [Local Development Setup](#local-development-setup)
- [Local LLM Development (Docker)](#local-llm-development-docker)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Generating API Keys for External Apps](#generating-api-keys-for-external-apps)
- [API Reference](#api-reference)
- [Deployment](#deployment)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router, TypeScript strict mode |
| UI | Tailwind CSS v4, custom WRP purple theme |
| ORM | Prisma v7 + Neon serverless PostgreSQL + pgvector |
| Auth (UI) | NextAuth.js v5 — JWT, 8h session, httpOnly cookie |
| Auth (API) | Bearer token API keys — SHA-256 hashed, scoped, rate-limited |
| AI — responses | Anthropic Claude (claude-sonnet-4-6 / claude-haiku-4-5) via Vercel AI SDK — or a local LM Studio model when `LLM_BASE_URL` is set (see [Local LLM Development](#local-llm-development-docker)) |
| AI — embeddings | OpenAI `text-embedding-3-small` via Vercel AI SDK — or a local LM Studio embedding model when `EMBEDDING_BASE_URL` is set |
| Source processing | Synchronous — PDF parsing, chunking, and embedding run inline (no job queue); PDFs use an in-memory two-phase flow, never touching file storage |
| Rate limiting | Upstash Redis (optional — disabled if unset) |
| Deployment | Vercel (app + jobs) + Neon (database) — or self-contained Docker Compose for local/offline dev |

---

## Required Services & API Keys

You need accounts and API keys for each of the following before the app will fully function (Upstash is optional — see below).

### 1. Neon (PostgreSQL database)
- Sign up at [neon.tech](https://neon.tech)
- Create a project and note the **DATABASE_URL** (pooler) and **DIRECT_URL** (direct/non-pooler) connection strings
- The `pgvector` extension is required — Neon enables it automatically

### 2. Anthropic API (AI responses)
- Sign up at [console.anthropic.com](https://console.anthropic.com)
- Create an API key under **API Keys**
- Used for: answering questions, chat, and summarising sources
- Models used: `claude-sonnet-4-6` (primary), `claude-haiku-4-5-20251001` (fast/cheap operations)

### 3. OpenAI API (embeddings)
- Sign up at [platform.openai.com](https://platform.openai.com)
- Create an API key under **API keys**
- Used for: generating text embeddings (`text-embedding-3-small`) for semantic search
- Note: only embeddings use OpenAI; all chat/generation uses Anthropic

### 4. Upstash Redis (rate limiting — optional)
- Sign up at [upstash.com](https://upstash.com)
- Create a Redis database (free tier is sufficient)
- Copy the **REST URL** and **REST Token**
- Used for: enforcing per-API-key rate limits on public API endpoints
- If omitted, rate limiting is simply disabled (no fallback) — fine for local dev, not recommended for production

### 5. Vercel (hosting)
- Sign up at [vercel.com](https://vercel.com)
- Connect your GitHub repository and import the project
- All environment variables below must be added in **Project Settings → Environment Variables**

> **Note:** `@vercel/blob` is a listed dependency (and `Source.blobUrl` exists in the schema) but has no
> current call sites — PDFs use an in-memory two-phase flow and other source types store content
> directly, so no file ever reaches Blob storage today. `BLOB_READ_WRITE_TOKEN` is not required to run
> the app; it's left in place for a planned future binary-upload path.

---

## Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/Bear-Wynd-Consulting/WRP-Notebook.git
cd WRP-Notebook

# 2. Install dependencies
npm install

# 3. Copy the environment variable template and fill in your values
cp .env.example .env.local   # or create .env.local manually (see below)

# 4. Generate the Prisma client
npx prisma generate

# 5. Apply pending migrations to your Neon database
npx prisma migrate deploy

# 6. Start the Next.js dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

---

## Local LLM Development (Docker)

For fully offline development — no Anthropic/OpenAI keys, no cloud Neon project — `docker-compose.yml` runs the whole stack locally: Postgres + pgvector for the database, a [wsproxy](https://github.com/neondatabase/wsproxy) shim so `@prisma/adapter-neon` (which speaks Neon's `wss://` protocol) can talk to that plain Postgres container, and [LM Studio](https://lmstudio.ai)/`llmster` as an OpenAI-compatible local model server for both chat and embeddings.

`lib/ai/providers.ts` switches providers based on whether `LLM_BASE_URL` is set: unset → Anthropic (chat) + OpenAI (embeddings) against the cloud; set → both chat and embeddings route through the same OpenAI-compatible endpoint at `LLM_BASE_URL` / `EMBEDDING_BASE_URL`. There is no separate fast-model routing locally — `primaryLlm`, `fastLlm`, and `fallbackLlm` all call the same `LLM_MODEL` when running local.

Postgres and wsproxy always start; which `notebook` service (if any) starts alongside them depends on the Compose profile:

| Profile | What it starts | When to use it |
|---|---|---|
| `local-dev` | `notebook` container only — reaches LM Studio on the host via `host.docker.internal` | **Default for development.** Run LM Studio yourself (GUI or `lms server start --port 1234`), load whatever models you want, then start just the app container. |
| `phase2` | `llmster` container + `notebook` container | Fully self-contained, no host-installed LM Studio. Needs the NVIDIA Container Toolkit for GPU passthrough on Linux; on Apple Silicon it falls back to CPU-only inference (no Metal passthrough into the container). |
| `ai-pc` | `llmster` container + `notebook-ai-pc` (pulls `wynderoem/wrp-notebook:latest` from Docker Hub — no local build) | A pre-provisioned "AI PC" — skips the `npm ci` + `next build` steps entirely. |

```bash
# Phase 1 (recommended) — LM Studio on the host, notebook in Docker
lms server start --port 1234
docker compose --profile local-dev --env-file .env.local up --build

# Phase 2 — fully self-contained, llmster runs as a container too
docker compose --profile phase2 --env-file .env.local up --build

# AI-PC — pull the pre-built image, no build step
docker compose --profile ai-pc --env-file .env.local up
```

The `phase2`/`ai-pc` `llmster` container auto-loads `gemma-4-2b-it` (chat) and `embedding-gemma-300m` (embeddings) on startup. If you load different models — either in the `local-dev` profile's host LM Studio, or by editing the `lms load` command for `phase2`/`ai-pc` — set `LLM_MODEL` / `EMBEDDING_MODEL` in `.env.local` to match exactly, or requests will 404 against LM Studio's model registry.

Required `.env.local` values for this mode (see [Environment Variables](#environment-variables) for the rest):

```bash
LOCAL_POSTGRES="true"                        # routes lib/db/client.ts through the wsproxy shim instead of cloud Neon
# The port in DATABASE_URL is not actually dialed — LOCAL_POSTGRES=true makes
# lib/db/client.ts rewrite the proxy target to wsproxy:80/v1 regardless of
# what's written here. Host only matters, but keep it pointed at the wsproxy service.
DATABASE_URL="postgresql://postgres:postgres@wsproxy:5432/notebook?sslmode=disable"
DIRECT_URL="postgresql://postgres:postgres@postgres:5432/notebook?sslmode=disable"

LLM_BASE_URL="http://llmster:1234"           # host.docker.internal:1234 instead, for the local-dev profile
ANTHROPIC_API_KEY="lm-studio"                # unused when LLM_BASE_URL is set — @ai-sdk/anthropic just expects a non-empty value
LLM_MODEL="gemma-4-2b-it"                    # must match a model already loaded in LM Studio

EMBEDDING_BASE_URL="http://llmster:1234/v1"
EMBEDDING_API_KEY="lm-studio"
EMBEDDING_MODEL="embedding-gemma-300m"
EMBEDDING_DIMENSIONS="768"                    # must match the vector(N) column in prisma/schema.prisma
```

Once the containers are up, apply migrations and create an admin user the same way as [Database Setup](#database-setup) below — but run `npx prisma migrate deploy` from your host machine (not inside a container), so use the host-mapped port instead of the Docker service name:

```bash
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/notebook?sslmode=disable" \
  npx prisma migrate deploy
```

There's no Neon SQL Editor for the local Postgres container — run SQL directly against it instead:

```bash
docker exec -it wrp-notebook-postgres-1 psql -U postgres -d notebook \
  -c "SELECT id, email, role FROM notebook.\"User\";"
```

---

## Environment Variables

Create a `.env.local` file in the project root with the following values. Everything except Upstash and Blob is required for the app to function.

```bash
# ─── Database (Neon) ───────────────────────────────────────────────────────────
# Pooler endpoint — used at runtime by the Neon serverless driver.
# Use wrp_notebook_app (CRUD on schema "notebook", no DDL) — NOT neondb_owner.
# See "Applying migrations" below for why the runtime credential must not have DDL rights.
DATABASE_URL="postgresql://wrp_notebook_app:...@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Direct endpoint — used by Prisma CLI for migrations ONLY.
# Not read by the app at runtime (see lib/db/client.ts) and not needed in Vercel's
# deployed env vars. Only set this locally, transiently, when running a migration.
DIRECT_URL="postgresql://neondb_owner:...@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Read-only connection to WRP property management tables (run scripts/setup-readonly-role.sql first)
PROPERTY_DB_URL="postgresql://wrp_notebook_app:...@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"

# ─── Authentication ────────────────────────────────────────────────────────────
# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET="<random-32-byte-secret>"
NEXTAUTH_URL="http://localhost:3000"   # Change to production URL when deploying

# ─── AI Providers ─────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."

# ─── Credential Encryption ────────────────────────────────────────────────────
# AES-256-GCM key for encrypting stored AI provider credentials
# Generate with: openssl rand -hex 32
CREDENTIAL_ENCRYPTION_KEY="<64-hex-char-key>"

# ─── Upstash Redis (Rate Limiting — optional) ─────────────────────────────────
# If unset, rate limiting on /api/v1/* is simply disabled (no fallback limiter).
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."

# ─── File Storage (Vercel Blob — currently unused, no call sites) ─────────────
# Not read anywhere in the app today; safe to omit. Kept for a planned future
# binary-upload path. See the note under "Required Services" above.
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

---

## Database Setup

### Initial migration

```bash
npx prisma migrate deploy
```

### Applying migrations to production (deliberately manual)

`DATABASE_URL` (the credential deployed to Vercel) is `wrp_notebook_app`, which only has
`SELECT`/`INSERT`/`UPDATE`/`DELETE` on the `notebook` schema — no `CREATE`/`ALTER`/`DROP`.
This is intentional: the running app should never hold a credential capable of changing
its own schema. Vercel's build (`prisma generate && next build`) and CI never run
`prisma migrate deploy`, so no DDL-capable credential exists in any deployed environment.

To apply a new migration to the live database, run it manually from your machine using
the `neondb_owner` connection string (get it from the Neon Console → Connection Details;
keep it in a password manager, never in a committed file):

```bash
DIRECT_URL="postgresql://neondb_owner:...@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  npx prisma migrate deploy
```

If a migration adds a new table, `wrp_notebook_app` will automatically get `SELECT`/
`INSERT`/`UPDATE`/`DELETE` on it — this project's `ALTER DEFAULT PRIVILEGES` was already
applied for the `notebook` schema. It will **not** get `CREATE`, by design.

### WRP property management read-only access

The app can query WRP's existing property management tables (spaces, tenants, maintenance tickets, etc.) using a read-only role. Run this once in the Neon SQL Editor:

```bash
# Open the script, follow the steps inside, then run it in Neon SQL Editor
cat scripts/setup-readonly-role.sql
```

The script creates a `wrp_notebook_ro` role with SELECT-only access on property tables and a `wrp_notebook_app` login user. Set `PROPERTY_DB_URL` to this user's connection string.

### Creating the first admin user

Users are stored in the `User` table with bcrypt-hashed passwords. To create the first admin account, run this in the Neon SQL Editor — replace the hash with the output of bcrypt-hashing your password:

```sql
-- Generate bcrypt hash first:
--   node -e "const b=require('bcryptjs'); b.hash('yourpassword',12).then(console.log)"
INSERT INTO "User" (id, email, "passwordHash", role, "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'admin@wrp.ca', '<bcrypt-hash>', 'admin', now(), now());
```

---

## Generating API Keys for External Apps

API keys allow WRP's property tour app, property management app, and website to access notebooks programmatically. Keys are scoped — each scope determines what the key can read or write.

### Scope overview

| Scope | What it can do |
|---|---|
| `ADMIN` | Full CRUD on all notebooks + create/revoke API keys |
| `INTERNAL` | Full CRUD on PUBLIC and INTERNAL notebooks (can be restricted to specific notebooks) |
| `EXTERNAL` | Read-only on PUBLIC notebooks only |

### Step 1 — Bootstrap the first ADMIN key

> **Where does this run?**
> The bootstrap script runs **on your local machine in a terminal** (VS Code terminal, Windows Terminal, PowerShell, or any shell). It does not run inside the app, it is not a dashboard feature, and it does not connect to the database. Its only job is to generate a key and print the SQL you need to paste into Neon's browser-based SQL editor. You need the project cloned and Node.js installed — nothing else.

The problem this solves: the API endpoint that creates keys (`POST /api/v1/admin/api-keys`) requires an existing ADMIN key to authenticate. That's a chicken-and-egg situation for the very first key. The bootstrap script breaks that loop by generating the key locally and giving you the SQL to insert it directly.

#### What you need before starting

- The repository cloned to your machine
- Node.js 18 or later installed (`node --version` to check)
- Access to [console.neon.tech](https://console.neon.tech) — the Neon web dashboard where you can run SQL queries against your database
- A password manager or secure note ready to store the key

#### 1a. Open a terminal in the project folder

In VS Code: open the project folder, then press `` Ctrl+` `` (backtick) to open the integrated terminal. The prompt should show the `WRP-Notebook` directory.

Alternatively, open Windows Terminal or PowerShell and `cd` to the project:

```bash
cd C:\Users\cwynder\WRP_notebook\WRP-Notebook
```

#### 1b. Run the script

```bash
node scripts/bootstrap-admin-key.mjs
```

You can give the key a descriptive name — useful for tracking which key belongs to which system:

```bash
node scripts/bootstrap-admin-key.mjs "WRP Admin — Production"
```

The script prints entirely to the terminal. It does not write any files, does not connect to the internet, and does not touch the database. The output looks like this:

```
──────────────────────────────────────────────────────────────────────
  WRP Knowledge Hub — Admin Key Bootstrap
──────────────────────────────────────────────────────────────────────

  STEP 1 — Copy your API key NOW.
  This is the only time the plaintext key will be shown.

  Key:    wrp_k1_AbCdEf1234...

──────────────────────────────────────────────────────────────────────

  STEP 2 — Run the SQL below in Neon SQL Editor.
  Dashboard → your project → SQL Editor → paste and run.

INSERT INTO "ApiKey" (
  id, name, "keyHash", "keyPrefix", scope, ...
) VALUES ( ... );

──────────────────────────────────────────────────────────────────────

  STEP 3 — Verify the insert worked.

  SELECT id, name, "keyPrefix", scope FROM "ApiKey" WHERE id = '...';

  STEP 4 — Test the key.

  curl https://wrp-notebook.vercel.app/api/v1/health \
    -H "Authorization: Bearer wrp_k1_AbCdEf1234..."

──────────────────────────────────────────────────────────────────────
```

**Immediately copy the `Key:` line** (the full `wrp_k1_...` value) and save it in your password manager. Once you close the terminal window the key is gone — it is not stored anywhere on disk or in the database.

#### 1c. Insert the key into the database via Neon SQL Editor

The Neon SQL Editor is a browser-based query tool at [console.neon.tech](https://console.neon.tech) — the same place you would normally use a database admin GUI. You do not need `psql`, DBeaver, or any local database tool.

1. Go to [console.neon.tech](https://console.neon.tech) and sign in
2. Click your project name in the project list (it will be named something like `neondb` or your chosen project name — the connection string contains `ep-green-wildflower-amyigtm1`)
3. In the left sidebar, click **SQL Editor**
4. At the top of the editor, confirm the database is set to `neondb` (not a branch or different DB)
5. Select all the existing text in the editor and delete it
6. Switch back to your terminal, select the entire `INSERT INTO "ApiKey" ( ... ) VALUES ( ... );` block that the script printed, and copy it
7. Paste it into the Neon SQL Editor
8. Click the **Run** button (top right of the editor), or press `Ctrl+Enter` / `Cmd+Enter`
9. In the results panel at the bottom you should see `INSERT 1` — this means one row was inserted successfully

If you see an error like `duplicate key value violates unique constraint`, the key prefix already exists — run the script again to generate a fresh key.

#### 1d. Confirm the row exists

Still in the Neon SQL Editor, clear the editor, paste the verification query the script printed, and run it:

```sql
SELECT id, name, "keyPrefix", scope, "createdAt"
FROM "ApiKey"
WHERE scope = 'ADMIN'
ORDER BY "createdAt" DESC
LIMIT 5;
```

You should see your key listed with `scope = ADMIN` and a recent `createdAt` timestamp. If the table is empty or your row is missing, the INSERT did not complete — check the error message in the results panel and try again.

#### 1e. Test the key against the live API

Back in your terminal, paste the `curl` command the script printed (or use the one below with your actual key):

```bash
curl https://wrp-notebook.vercel.app/api/v1/health \
  -H "Authorization: Bearer wrp_k1_<your-full-key>"
```

Expected response:

```json
{ "data": { "status": "ok" } }
```

If you receive `401 Unauthorized`, check:
- The key was copied in full, with no line breaks or trailing spaces
- The Neon SQL Editor showed `INSERT 1` when you ran the SQL
- The Vercel deployment is live and up to date

#### What if I lose the key?

The plaintext is never stored — only its SHA-256 hash lives in the database. If you lose a key, run the script again to generate a new one and insert it the same way. You can have multiple ADMIN keys active simultaneously. To revoke a lost or compromised key by its visible prefix:

```sql
-- Run in Neon SQL Editor
UPDATE "ApiKey"
SET "revokedAt" = NOW()
WHERE "keyPrefix" = 'wrp_k1_Ab'; -- the first 12 characters shown on the API Keys dashboard page
```

### Step 2 — Create keys for external apps via the API

Once you have an ADMIN key, use it to create all future keys through the REST API. The key is returned **once** in the response and never stored in plaintext.

**Property Tour App (read-only public notebooks):**

```bash
curl -X POST https://wrp-notebook.vercel.app/api/v1/admin/api-keys \
  -H "Authorization: Bearer wrp_k1_<your-admin-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Property Tour App",
    "scope": "EXTERNAL",
    "rateLimit": 200
  }'
```

**Property Management App (read/write, all notebooks):**

```bash
curl -X POST https://wrp-notebook.vercel.app/api/v1/admin/api-keys \
  -H "Authorization: Bearer wrp_k1_<your-admin-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Property Management App",
    "scope": "INTERNAL",
    "rateLimit": 500
  }'
```

**Restrict a key to specific notebooks only:**

```bash
curl -X POST https://wrp-notebook.vercel.app/api/v1/admin/api-keys \
  -H "Authorization: Bearer wrp_k1_<your-admin-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "WRP Website — Building 100 only",
    "scope": "EXTERNAL",
    "notebookIds": ["<notebook-cuid>", "<notebook-cuid>"],
    "rateLimit": 100,
    "expiresAt": "2027-01-01T00:00:00Z"
  }'
```

**Response (save the `key` field — it will not be shown again):**

```json
{
  "data": {
    "id": "clxxx...",
    "name": "Property Tour App",
    "keyPrefix": "wrp_k1_a3b4",
    "scope": "EXTERNAL",
    "rateLimit": 200,
    "createdAt": "2026-04-16T...",
    "key": "wrp_k1_<full-plaintext-key>"
  }
}
```

### Step 3 — Use the key in an external app

Pass the key as a Bearer token in the `Authorization` header of every API request:

```bash
# List public notebooks
curl https://wrp-notebook.vercel.app/api/v1/notebooks \
  -H "Authorization: Bearer wrp_k1_<key>"

# Search a notebook
curl -X POST https://wrp-notebook.vercel.app/api/v1/notebooks/<id>/search \
  -H "Authorization: Bearer wrp_k1_<key>" \
  -H "Content-Type: application/json" \
  -d '{"query": "available spaces in Building 100"}'

# Ask a question
curl -X POST https://wrp-notebook.vercel.app/api/v1/notebooks/<id>/ask \
  -H "Authorization: Bearer wrp_k1_<key>" \
  -H "Content-Type: application/json" \
  -d '{"question": "What amenities are available?"}'
```

### Step 4 — View and manage keys in the dashboard

Log in as an `admin` user and navigate to **API Keys** in the top navigation. The dashboard shows all active keys, their scopes, and last-used dates. To revoke a key, call:

```bash
curl -X DELETE https://wrp-notebook.vercel.app/api/v1/admin/api-keys/<key-id> \
  -H "Authorization: Bearer wrp_k1_<your-admin-key>"
```

---

## API Reference

All endpoints are under `/api/v1/`. Every response uses the envelope `{ "data": ... }` for success or `{ "error": "...", "code": "..." }` for errors.

### Notebooks

| Method | Endpoint | Scope required | Description |
|---|---|---|---|
| GET | `/api/v1/notebooks` | Any | List notebooks visible to the key |
| POST | `/api/v1/notebooks` | INTERNAL, ADMIN | Create a notebook |
| GET | `/api/v1/notebooks/:id` | Any (visibility rules) | Get a notebook |
| PATCH | `/api/v1/notebooks/:id` | INTERNAL, ADMIN | Update name/description/visibility |
| DELETE | `/api/v1/notebooks/:id` | INTERNAL, ADMIN | Soft-delete a notebook |

### Sources

| Method | Endpoint | Scope required | Description |
|---|---|---|---|
| GET | `/api/v1/notebooks/:id/sources` | Any | List sources in a notebook |
| POST | `/api/v1/notebooks/:id/sources` | INTERNAL, ADMIN | Add a source (JSON body or multipart file) |

### Notes

| Method | Endpoint | Scope required | Description |
|---|---|---|---|
| GET | `/api/v1/notebooks/:id/notes` | Any | List notes in a notebook |
| POST | `/api/v1/notebooks/:id/notes` | INTERNAL, ADMIN | Create a note |
| PATCH | `/api/v1/notes/:id` | INTERNAL, ADMIN | Update a note |
| DELETE | `/api/v1/notes/:id` | INTERNAL, ADMIN | Delete a note |

### Search & AI

| Method | Endpoint | Scope required | Description |
|---|---|---|---|
| POST | `/api/v1/notebooks/:id/search` | Any | Hybrid vector + keyword search |
| POST | `/api/v1/notebooks/:id/ask` | Any | One-shot Q&A with source citations |
| POST | `/api/v1/notebooks/:id/chat` | Any | Streaming chat (Server-Sent Events) |
| GET | `/api/v1/notebooks/:id/chat/sessions` | Any | List chat sessions |

### Admin

| Method | Endpoint | Scope required | Description |
|---|---|---|---|
| GET | `/api/v1/admin/api-keys` | ADMIN | List all API keys |
| POST | `/api/v1/admin/api-keys` | ADMIN | Create an API key |
| DELETE | `/api/v1/admin/api-keys/:id` | ADMIN | Revoke an API key |
| GET | `/api/v1/admin/audit-log` | ADMIN | View audit log |

### Source ingestion — supported types

When adding a source via `POST /api/v1/notebooks/:id/sources`, set `type` to one of:

| Type | How to submit | What the pipeline does |
|---|---|---|
| `text` | JSON body with `text` field | Chunks and embeds content directly |
| `url` | JSON body with `url` field | Fetches page, strips HTML, chunks and embeds |
| `youtube` | JSON body with `url` field | Fetches page content; full transcript requires YouTube Data API |
| `pdf` | **Not** via this endpoint — use the two-phase flow: `POST /api/v1/sources/extract` (parses in-memory, never persisted) then `POST /api/v1/sources/commit` (saves + embeds, no file storage involved) |
| `audio` | `multipart/form-data` with `file` field | ⚠️ Not functional yet — the uploaded buffer is decoded as UTF-8 text, which corrupts real audio files. Whisper transcription is not implemented. |

---

## Deployment

### Vercel (recommended)

```bash
# Deploy to production
vercel --prod --scope bear-wynd-consultings-projects
```

Add all environment variables listed above in **Vercel → Project Settings → Environment Variables**. The `NEXTAUTH_URL` must be set to the production URL (`https://wrp-notebook.vercel.app`).

### Development commands

```bash
npm run dev          # Start Next.js dev server
npm run build        # Production build (also runs prisma generate)
npm run lint         # ESLint

npx prisma studio          # Open database GUI
npx prisma migrate dev     # Create and apply a new migration
npx prisma migrate deploy  # Apply pending migrations (CI/production)
npx prisma generate        # Regenerate Prisma client after schema change
```

---

*Powered by [Open Notebook](https://github.com/lfnovo/open-notebook) (MIT)*
