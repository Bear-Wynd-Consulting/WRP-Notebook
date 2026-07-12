# Sprint Plan — OCR for Handwritten PDFs (`local_llm_docker`)

Builds on the recommendation in [`ocr-handwritten-pdf-evaluation.md`](./ocr-handwritten-pdf-evaluation.md): add a GOT-OCR2.0-based CPU sidecar to the `local_llm_docker` branch's PDF ingestion flow. GPU-tier (olmOCR/Qwen2.5-VL) and `main`/Vercel support are explicitly out of scope for this sprint.

**Assumptions** (adjust if your team's actuals differ): one engineer, 2-week sprint (10 working days), Fibonacci points, points are the same engineer's — not a team velocity average.

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

### OCR-0 — Spike: benchmark GOT-OCR2.0 CPU latency/page
Run GOT-OCR2.0 via `transformers` on a representative scanned/handwritten page (no Docker/FastAPI yet) and measure wall-clock time per page on a typical dev machine. This is sequenced *first* because it resolves the sprint's biggest open risk before any integration code is written: if CPU latency is too high for a synchronous HTTP call (e.g. multi-page docs pushing past a reasonable timeout), OCR-4/OCR-5 need to be scoped for async/polling instead of the drop-in-replacement design.
**Acceptance criteria:** documented seconds/page figure (average + p95 across ≥5 sample pages); go/no-go note on whether the synchronous route design from the evaluation doc still holds, or whether OCR-4 needs to become async.

### OCR-1 — Scaffold `ocr` sidecar
New `ocr` service: `python:3.11-slim` base, FastAPI/uvicorn skeleton, `/health` endpoint, `docker-compose.yml` entry present in `local-dev`, `phase2`, and `ai-pc` profiles. Add `OCR_BASE_URL`, `OCR_ENABLED`, `OCR_TEXT_DENSITY_THRESHOLD` to `.env.example`. Decide and document whether model weights are baked into the image at build time or downloaded on first run (affects image size vs. cold-start time — pick baked-in for predictable startup, matching how `llmster` ships pre-loaded models).
**Acceptance criteria:** `docker compose --profile local-dev up ocr` starts cleanly; `curl localhost:<port>/health` returns 200.

### OCR-2 — PDF rasterization
Implement PyMuPDF (`fitz`) page-to-image rendering inside the sidecar: ~200 DPI, page-count cap (e.g. first 20 pages), grayscale/contrast normalization.
**Acceptance criteria:** given a multi-page PDF, sidecar produces one normalized image per page (up to the cap) with unit tests covering a single-page, multi-page, and over-the-cap PDF.

### OCR-3 — Model integration
Load GOT-OCR2.0 weights, implement `POST /ocr` (PDF bytes in → `{ text, numpages }` out), reusing OCR-2's rasterization internally.
**Acceptance criteria:** posting a sample handwritten PDF returns non-empty, roughly-correct text; posting a corrupt/non-PDF file returns a clean 4xx, not a crash.

### OCR-4 — Wire extract-route fallback
In `app/api/v1/sources/extract/route.ts`, after `pdf-parse` runs, compute chars-per-page; below `OCR_TEXT_DENSITY_THRESHOLD` (or zero text), call the sidecar instead of throwing `EMPTY_DOCUMENT`. Reuses the existing `{ text, numpages }` shape so downstream `fastLlm` structuring is untouched. Add `source: "text-layer" | "ocr"` to the response.
**Acceptance criteria:** a normal typed-text PDF is unaffected (regression check — no sidecar call, `source: "text-layer"`); a scanned/handwritten PDF now completes instead of erroring, tagged `source: "ocr"`.

### OCR-5 — Error handling & UX
Handle sidecar unreachable (network/timeout) and sidecar-returns-still-empty (genuinely blank page) as distinct cases. Decide and implement the user-facing behavior (e.g. partial-success banner suggesting manual entry vs. a clear error), informed by OCR-0's latency findings for timeout tuning.
**Acceptance criteria:** killing the `ocr` container mid-request produces a clear, non-crashing error to the user; a blank input page returns a clear "no text found" state, not a silent empty note.

### OCR-6 — Validation & tuning
Test against a small real-world set of handwritten scans (cursive, mixed print/cursive, multi-page inspection notes if available from the property management use case). Tune `OCR_TEXT_DENSITY_THRESHOLD` against both false positives (typed PDFs routed to OCR unnecessarily) and false negatives (lightly-scanned pages that should've gone to OCR but didn't). Update both docs with final measured numbers.
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
