@AGENTS.md

# WRP Notebook — CLAUDE.md

## Project Overview

WRP Notebook is a Vercel-deployable knowledge management platform built for Western Research Parks.
It provides a public REST API for integration with WRP's property tour app, property management app,
and website. Inspired by open-notebook (MIT), rebuilt in TypeScript for a fully serverless stack.

## Stack

- **Framework**: Next.js 16 App Router, TypeScript strict mode
- **UI**: Tailwind CSS v4, shadcn/ui (WRP purple theme)
- **ORM**: Prisma v7 with Neon serverless PostgreSQL + pgvector
- **DB Driver**: `@neondatabase/serverless` (connection pooling)
- **Auth (UI)**: NextAuth.js v5 — JWT, 8h session, httpOnly cookie
- **Auth (API)**: Bearer token API keys (SHA-256 hashed, scoped, rate-limited)
- **AI**: Vercel AI SDK — Anthropic Claude (primary), OpenAI (embeddings + fallback)
  - Task-aware embedding wrapper at `lib/ai/task-aware-embed.ts`
  - Inngest step functions replace LangGraph workflows
  - Cohere reranking via `rerank()` (replaces Esperanto Jina/Voyage)
- **Background Jobs**: Inngest (serverless, Vercel-native)
- **File Storage**: Vercel Blob (private paths only — signed URLs for access)
- **Deployment**: Vercel (app + API + jobs) + Neon (database)

## Architecture

```
app/
  api/
    v1/              → Public REST API (API key auth + rate limiting)
    inngest/         → Inngest webhook handler (signing key verified)
    auth/            → NextAuth.js handlers
  (auth)/            → Login/signup pages
  (dashboard)/       → Protected UI pages (NextAuth session required)

lib/
  ai/                → AI provider abstraction (Vercel AI SDK)
  auth/              → API key generation, authorization, IDOR checks
  security/          → URL validation, file upload, credential encryption, sanitization
  db/                → Prisma client + pgvector helpers (parameterized queries only)
  jobs/              → Inngest function definitions
  validation/        → Zod schemas for all API inputs
  api/               → Response filters, error envelope

prisma/
  schema.prisma      → Database schema (includes AuditLog, ApiKey, Credential)
  migrations/        → Migration history
```

## Conventions

- All API responses: `{ data: T } | { error: string, code: string }`
- Prisma transactions for multi-table operations
- Zod validation on all API inputs — no raw request body access
- Neon branching for preview deployments (Vercel integration auto-provisions)
- shadcn/ui components in `components/ui/`; domain components in `components/<domain>/`

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npx prisma studio    # Database GUI
npx prisma migrate dev   # Apply schema changes (needs DATABASE_URL + DIRECT_URL)
npx prisma generate  # Regenerate Prisma client after schema change
```

---

## Security Conventions (non-negotiable)

### Query Safety
- **NEVER** import `prisma` directly in route handlers
- **ALWAYS** use `lib/db/scoped-queries.ts` — every query is filtered by ownerId/scope
- All pgvector queries use `$queryRaw` with parameterized placeholders (no interpolation)

### API Keys
- SHA-256 hashed at rest — plaintext shown exactly once at creation
- Timing-safe comparison via `crypto.timingSafeEqual`
- Every key has rateLimit (default 100 req/min), optional expiry, optional notebook restrictions
- ADMIN scope: full CRUD + key management | INTERNAL: full CRUD | EXTERNAL: read-only PUBLIC notebooks

### Input Validation
- Zod schema on every API route — reject before processing
- File uploads: magic-byte MIME detection (not Content-Type header)
- URL ingestion: SSRF protection — DNS resolution + private IP blocklist

### Output Safety
- `toPublicNotebook()`, `toPublicSource()`, `toPublicApiKey()` on every API response
- `blobUrl`, `keyHash`, `ownerId` never returned to API consumers
- Error responses: `{ error: "message", code: "CODE" }` — never include stack traces or SQL

### AI Safety
- Prompt injection: delimiter-isolated context blocks, anti-instruction rules in system prompt
- AI output sanitized with DOMPurify before render or storage
- Cost guards: maxTokens cap, chat history truncation (50 messages), embedding batch limits

### Auth
- NextAuth: 8h maxAge, httpOnly, sameSite: lax, secure: true
- All `(dashboard)/*` routes protected via `auth()` check in layout
- Admin-only routes additionally check `session.user.role === 'admin'`

### Secrets
- `CREDENTIAL_ENCRYPTION_KEY` in Vercel env vars only — never in code
- Different key per environment (preview vs production)
- AES-256-GCM (authenticated encryption) for AI provider credentials

---

## Security File Map

| File | Purpose |
|------|---------|
| `lib/auth/api-keys.ts` | Key generation, SHA-256 hash, timing-safe comparison |
| `lib/auth/authorize.ts` | Row-level IDOR prevention — `authorizeNotebookAccess()` |
| `lib/auth/auth-config.ts` | NextAuth.js v5 session hardening |
| `lib/db/client.ts` | Prisma singleton (Neon serverless driver) |
| `lib/db/scoped-queries.ts` | Ownership-filtered Prisma wrappers |
| `lib/db/vector-search.ts` | pgvector cosine similarity (parameterized) |
| `lib/security/url-validator.ts` | SSRF protection with DNS resolution check |
| `lib/security/file-upload.ts` | Magic-byte MIME detection + 50MB limit |
| `lib/security/sanitize.ts` | DOMPurify XSS prevention |
| `lib/security/credentials.ts` | AES-256-GCM encrypt/decrypt |
| `lib/ai/safe-prompt.ts` | Prompt injection isolation |
| `lib/ai/task-aware-embed.ts` | Task-prefixed embedding wrapper |
| `lib/ai/cost-guard.ts` | Token caps, chat truncation, batch limits |
| `lib/api/response-filters.ts` | Strip internal fields from API responses |
| `lib/api/error-response.ts` | Generic error envelope (no leaks) |
| `lib/validation/schemas.ts` | Zod schemas for all API inputs |
| `middleware.ts` | Request size limits, CORS, API auth entry point |
| `.github/workflows/security.yml` | npm audit + lockfile-lint + Gitleaks |

---

## WRP Branding

Colour palette (Western University purple):

```
--wrp-primary:    #4F2683  (Western Purple)
--wrp-secondary:  #807F83  (Western Grey)
--wrp-accent:     #E3D3F5  (Light purple tint)
--wrp-dark:       #2C1650  (Dark purple)
--wrp-surface:    #F8F6FB  (Off-white purple tint)
```

MIT Attribution: Footer must include "Powered by Open Notebook" per MIT license.

---

## API Key Scopes

| Scope | Access |
|-------|--------|
| ADMIN | Full CRUD on all notebooks + API key management |
| INTERNAL | Full CRUD on PUBLIC + INTERNAL notebooks (optionally restricted to specific notebook IDs) |
| EXTERNAL | Read-only on PUBLIC notebooks only |

---

## WRP Integration Patterns

**Property Tour App**: `GET /api/v1/notebooks/{id}/sources` + `POST /api/v1/notebooks/{id}/ask`

**Property Management App**: `POST /api/v1/notebooks/{id}/sources` (upload docs) + `POST /api/v1/notebooks/{id}/search`

**WRP Website**: `GET /api/v1/notebooks/{id}/notes` + `POST /api/v1/notebooks/{id}/ask`
