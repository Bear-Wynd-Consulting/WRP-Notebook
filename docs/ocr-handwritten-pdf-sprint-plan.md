# Sprint Plan — OCR for Handwritten PDFs (`local_llm_docker`)

Builds on the recommendation in [`ocr-handwritten-pdf-evaluation.md`](./ocr-handwritten-pdf-evaluation.md): add a GOT-OCR2.0-based CPU sidecar to the `local_llm_docker` branch's PDF ingestion flow. GPU-tier (olmOCR/Qwen2.5-VL) and `main`/Vercel support are explicitly out of scope for this sprint.

**Assumptions** (adjust if your team's actuals differ): one engineer, 2-week sprint (10 working days), Fibonacci points, points are the same engineer's — not a team velocity average.

**Build status:** OCR-1, OCR-2, and OCR-4 are scaffolded and tested (see per-ticket notes below) on branch `claude/ocr-handwritten-pdf-eval-96v3iz`, which now includes the full `local_llm_docker` diff merged in. OCR-0 and the real-weight half of OCR-3 could **not** be executed in the sandbox this was built in — `huggingface.co` and `download.pytorch.org` were both blocked by egress policy, so the model-loading code in `ocr/app/engine.py` (`GotOcr2Engine`) is written from the HF model card but unverified against a live run. Everything is built behind a swappable `OcrEngine` interface (`stub` vs `got-ocr2`) specifically so this gap doesn't block the rest of the pipeline. See `ocr/README.md` for exactly what's left to verify on real hardware.

## Sprint Goal

Ship a working OCR fallback so a scanned/handwritten PDF uploaded through `local_llm_docker` produces structured text instead of failing with `EMPTY_DOCUMENT`, using a CPU-only GOT-OCR2.0 sidecar.

## Ticket Breakdown

| ID | Ticket | Points | Depends on |
|---|---|---|---|
| OCR-0 | **Spike: benchmark GOT-OCR2.0 CPU latency/page** | 2 | — |
| OCR-1 | Scaffold `ocr` sidecar (FastAPI, Dockerfile, compose wiring, env vars) | 3 | — |
| OCR-2 | PDF rasterization in sidecar (PyMuPDF, page cap, normalization) | 3 | OCR-1 |
| OCR-3 | GOT-OCR2.0 model integration + `/ocr` endpoint | 5 | OCR-1, OCR-2 |
| OCR-4 | Wire extract-route fallback (density check, sidecar call, `source` marker) | 3 | OCR-3 |
| OCR-5 | Error handling/timeouts + UX for partial/failed OCR | 2 | OCR-4 |
| OCR-6 | Validation with real handwritten scans, threshold tuning, doc updates | 3 | OCR-4, OCR-5 |
| **Committed total** | | **21** | |
| OCR-7 (backlog, not committed) | GPU-tier swap (Qwen2.5-VL/olmOCR) behind `phase2` | 5 | OCR-3 |

### OCR-0 — Spike: benchmark GOT-OCR2.0 CPU latency/page — **blocked, not done**
Run GOT-OCR2.0 via `transformers` on a representative scanned/handwritten page and measure wall-clock time per page. **Could not be executed**: this sprint's build sandbox had egress policy blocking both `huggingface.co` (weights) and `download.pytorch.org` (CPU-only torch wheel), so no live run was possible. Literature check found only qualitative signal (GOT-OCR2.0 "requires GPUs to reach real-time performance"; VLM-style OCR generally runs 5-10x slower than classic OCR on CPU) — no hard seconds/page figure exists anywhere, measured or published. **Still needs to run** on a machine with normal network access before OCR-4/OCR-5's synchronous-HTTP design is trusted for multi-page documents.
**Acceptance criteria (unchanged, still open):** documented seconds/page figure (average + p95 across ≥5 sample pages); go/no-go note on whether the synchronous route design holds or OCR-4 needs to become async.

### OCR-1 — Scaffold `ocr` sidecar — **done**
`ocr/` at repo root: `python:3.11-slim` base, FastAPI/uvicorn app (`app/main.py`), `/health` endpoint, `docker-compose.yml` service (no profile — starts in `local-dev`, `phase2`, and `ai-pc` alike, mirroring how `postgres`/`wsproxy` are always-on). `OCR_BASE_URL`, `OCR_ENABLED`, `OCR_TEXT_DENSITY_THRESHOLD` added to `.env.example`; `OCR_ENGINE` set on the `ocr` service itself. Model-weight packaging (baked-in vs. downloaded-on-first-run) is deferred to whoever runs OCR-3's real-weight verification — the `ocr-model-cache` volume in `docker-compose.yml` at least avoids re-downloading across container recreates either way.
**Verified:** `docker compose config` validates the full merged compose file cleanly; the FastAPI app boots under `TestClient` in tests.

### OCR-2 — PDF rasterization — **done**
`ocr/app/rasterize.py`: PyMuPDF (`fitz`) page-to-image rendering, ~200 DPI default, page-count cap (default 20), grayscale output.
**Verified:** `ocr/tests/test_rasterize.py` (4 tests, passing) covers single-page, multi-page, over-the-cap truncation, and DPI affecting output size — using PDFs generated on the fly with `fitz`, no external fixtures needed.

### OCR-3 — Model integration — **half done**
`POST /ocr` (`ocr/app/main.py`) is implemented and wired to a swappable `OcrEngine` interface (`ocr/app/engine.py`): `StubEngine` (deterministic placeholder, no weights, no network) and `GotOcr2Engine` (loads `stepfun-ai/GOT-OCR2_0` via `transformers.AutoModelForImageTextToText`). **The `stub` half is done and tested; the real `got-ocr2` half is unverified** — it was written from the HF model card but the same egress block that stopped OCR-0 also prevented ever instantiating this class. Whoever picks this up next needs to actually run it against a real handwritten page and confirm the processor/model calls are correct before flipping `OCR_ENGINE=got-ocr2` in production.
**Verified:** `ocr/tests/test_main.py` (4 tests, passing) exercises `/health`, empty-body rejection, non-PDF rejection, and a full round-trip against `StubEngine`. **Not verified:** `GotOcr2Engine` end-to-end.

### OCR-4 — Wire extract-route fallback — **done**
`app/api/v1/sources/extract/route.ts`: computes chars-per-page after `pdf-parse` runs; below `OCR_TEXT_DENSITY_THRESHOLD` (or zero text), calls the sidecar (`lib/ocr/client.ts`) instead of throwing `EMPTY_DOCUMENT` outright — but only when `OCR_ENABLED` is set, so branches/deployments without the sidecar keep today's exact behavior. Reuses the existing `{ text, numpages }` shape, so downstream `fastLlm` structuring is untouched. Response now includes `source: "text-layer" | "ocr"`.
**Verified:** `npx tsc --noEmit` and `npx eslint` clean on the changed files; `lib/ocr/__tests__/client.test.ts` (4 tests, passing) covers the success path, missing-field defaults, sidecar-unreachable, and non-2xx cases. **Not verified:** an actual end-to-end request through a running `docker compose` stack (needs OCR-0/OCR-3's real-weight verification first to be meaningful).

### OCR-5 — Error handling & UX — **partially done**
The route distinguishes sidecar-unreachable (`OcrUnavailableError` → `503 OCR_UNAVAILABLE`) from OCR-still-returned-empty (`422 EMPTY_DOCUMENT`, distinct message from the pre-OCR case) — both are implemented and unit-tested (see OCR-4). **Not done:** any UI-facing treatment (e.g. a banner distinguishing an OCR'd note from a text-layer one, using the new `source` field) — the ticket's UX-decision half is still open and wasn't attempted here since it's a frontend/product call, not a backend plumbing one.

### OCR-6 — Validation & tuning — **not started**
Test against a small real-world set of handwritten scans (cursive, mixed print/cursive, multi-page inspection notes if available from the property management use case). Tune `OCR_TEXT_DENSITY_THRESHOLD` against both false positives (typed PDFs routed to OCR unnecessarily) and false negatives (lightly-scanned pages that should've gone to OCR but didn't). Update both docs with final measured numbers. Blocked on OCR-0/OCR-3's real-weight verification — there's nothing meaningful to validate against the `stub` engine.
**Acceptance criteria:** threshold value justified with example cases; evaluation doc's "unbenchmarked latency" risk note replaced with actual measured numbers; at least one real handwritten sample ingested end-to-end into a notebook.

## Suggested Day-by-Day Sequencing

| Days | Work |
|---|---|
| 1 | OCR-0 (spike) + start OCR-1 |
| 2 | Finish OCR-1 |
| 3–4 | OCR-2 |
| 5–6 | OCR-3 |
| 7 | OCR-4 |
| 8 | OCR-5 |
| 9–10 | OCR-6 + buffer/bug-fix slack |

## Remaining Work

The blocker is the same for all of it: someone with normal network access (not this sandbox) needs to actually run the real OCR engine.

1. Run OCR-0's benchmark for real against `GotOcr2Engine` on representative hardware; confirm/revise the synchronous route design.
2. Smoke-test `GotOcr2Engine` (`ocr/app/engine.py`) directly — verify the `AutoProcessor`/`AutoModelForImageTextToText` calls actually produce sane text on a real handwritten page.
3. Set `OCR_ENGINE=got-ocr2` in `docker-compose.yml` (or `.env.local`) and run `docker compose --profile local-dev up --build` end-to-end with a real scanned/handwritten PDF through the notebook UI.
4. OCR-6: tune `OCR_TEXT_DENSITY_THRESHOLD` against real samples.
5. OCR-5's UI-facing half: decide how `source: "ocr"` should surface to the user (banner, badge, etc.) and implement it.

## Definition of Done (sprint-level)

- `docker compose --profile local-dev up` brings up the `ocr` service alongside existing services with no manual steps beyond `.env` config.
- Uploading a handwritten/scanned PDF through the notebook UI succeeds and produces a structured note instead of an `EMPTY_DOCUMENT` error.
- Existing typed-text PDF ingestion is unaffected (no regression).
- `.env.example`, `docker-compose.yml` docs/comments, and both OCR docs in `docs/` reflect the shipped implementation, not just the plan.

## Risks Carried Into the Sprint

- **CPU latency** (addressed first via OCR-0, but may still force scope changes to OCR-4/OCR-5 mid-sprint if the synchronous design doesn't hold).
- **Model weight packaging**: baking multi-hundred-MB weights into the `ocr` image affects Docker image size/build time — decide in OCR-1, don't defer.
- **Non-English handwriting accuracy** is unverified and explicitly not a goal this sprint — scope validation (OCR-6) to English samples.

## Explicitly Out of Scope This Sprint

- GPU-tier model swap (OCR-7 — backlog for a future sprint once the CPU path is proven).
- Any OCR support on `main`/Vercel (no PyTorch runtime available in serverless; separate research needed if ever required).
