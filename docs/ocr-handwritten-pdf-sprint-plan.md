# Sprint Plan — OCR for Handwritten PDFs (`local_llm_docker`)

Builds on the recommendation in [`ocr-handwritten-pdf-evaluation.md`](./ocr-handwritten-pdf-evaluation.md): add a GOT-OCR2.0-based CPU sidecar to the `local_llm_docker` branch's PDF ingestion flow. GPU-tier (olmOCR/Qwen2.5-VL) and `main`/Vercel support are explicitly out of scope for this sprint.

**Assumptions** (adjust if your team's actuals differ): one engineer, 2-week sprint (10 working days), Fibonacci points, points are the same engineer's — not a team velocity average.

**Build status:** OCR-1, OCR-2, and OCR-4 are scaffolded and tested (see per-ticket notes below) on branch `claude/ocr-handwritten-pdf-eval-96v3iz`, which now includes the full `local_llm_docker` diff merged in. OCR-0 and the real-weight half of OCR-3 could **not** be executed in the sandbox this was built in — `huggingface.co` and `download.pytorch.org` were both blocked by egress policy, so the model-loading code in `ocr/app/engine.py` (`GotOcr2Engine`) is written from the HF model card but unverified against a live run. Everything is built behind a swappable `OcrEngine` interface (`stub` vs `got-ocr2`) specifically so this gap doesn't block the rest of the pipeline.

**Update 2026-07-13:** OCR-0 and OCR-3's real-weight half were run for real on a machine with normal network access (bringing the `ocr` sidecar up on the `local_llm_docker` live Docker stack). `GotOcr2Engine` did not work as originally written — five bugs were found and fixed in the process (see OCR-0 and OCR-3 notes below). With those fixes, `got-ocr2` now produces correct OCR text end-to-end, but CPU inference is confirmed too slow for the current synchronous design (see OCR-0). See `ocr/README.md` for current status.

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

### OCR-0 — Spike: benchmark GOT-OCR2.0 CPU latency/page — **done (single-page sample; not the full ≥5-page average+p95)**
Run GOT-OCR2.0 via `transformers` on a representative scanned/handwritten page and measure wall-clock time per page. Run for real on 2026-07-13 against the `ocr` sidecar on the live `local_llm_docker` Docker stack (Docker Desktop on Windows, CPU-only, no GPU passthrough), single synthetic test page (rendered text, not a real handwritten scan):
- Cold start (download weights from Hugging Face + load into `transformers` + first inference): **~583s**.
- Weights already cached on disk (`ocr-model-cache` volume), model not yet loaded into the running process: **~505s**.
- Model already loaded in the running process (steady-state, repeat request): **~219s/page**.

**Go/no-go: no-go for the current synchronous design.** Even the best-case steady-state figure (~3.6 min/page) is far past `lib/ocr/client.ts`'s `OCR_TIMEOUT_MS` default (60s) and well beyond what a synchronous HTTP upload request should block on. OCR-4/OCR-5 need to become async (e.g. return a job ID immediately, poll or webhook for completion) before `got-ocr2` is usable outside of manual testing. This single-sample figure is enough to make that call; a real ≥5-page average+p95 (ideally on real handwritten/scanned samples, not synthetic rendered text) is still worth collecting before finalizing an async design's timeout/retry parameters — see OCR-6.

### OCR-1 — Scaffold `ocr` sidecar — **done**
`ocr/` at repo root: `python:3.11-slim` base, FastAPI/uvicorn app (`app/main.py`), `/health` endpoint, `docker-compose.yml` service (no profile — starts in `local-dev`, `phase2`, and `ai-pc` alike, mirroring how `postgres`/`wsproxy` are always-on). `OCR_BASE_URL`, `OCR_ENABLED`, `OCR_TEXT_DENSITY_THRESHOLD` added to `.env.example`; `OCR_ENGINE` set on the `ocr` service itself. Model-weight packaging (baked-in vs. downloaded-on-first-run) is deferred to whoever runs OCR-3's real-weight verification — the `ocr-model-cache` volume in `docker-compose.yml` at least avoids re-downloading across container recreates either way.
**Verified:** `docker compose config` validates the full merged compose file cleanly; the FastAPI app boots under `TestClient` in tests.

### OCR-2 — PDF rasterization — **done**
`ocr/app/rasterize.py`: PyMuPDF (`fitz`) page-to-image rendering, ~200 DPI default, page-count cap (default 20), grayscale output.
**Verified:** `ocr/tests/test_rasterize.py` (4 tests, passing) covers single-page, multi-page, over-the-cap truncation, and DPI affecting output size — using PDFs generated on the fly with `fitz`, no external fixtures needed.

### OCR-3 — Model integration — **done**
`POST /ocr` (`ocr/app/main.py`) is implemented and wired to a swappable `OcrEngine` interface (`ocr/app/engine.py`): `StubEngine` (deterministic placeholder, no weights, no network) and `GotOcr2Engine`. **The `stub` half is done and tested; the real `got-ocr2` half was fixed and verified for real on 2026-07-13.** As originally written (from the HF model card, never executed) it did not work — five bugs found running it against a live `ocr` sidecar:
1. `ocr/requirements.txt` pinned `uvicorn==0.39.1`, which does not exist on PyPI — corrected to `0.34.0`.
2. `stepfun-ai/GOT-OCR2_0`'s repo ships custom modeling code; `AutoConfig`/`AutoProcessor` refuse to load it without `trust_remote_code=True`.
3. That custom code imports `torchvision`, `verovio`, and `tiktoken`, none of which were in `requirements.txt`.
4. Even with `trust_remote_code=True`, `stepfun-ai/GOT-OCR2_0`'s custom code defines a `GOTConfig` class that `AutoModelForImageTextToText` doesn't recognize at all (`ValueError: Unrecognized configuration class`). The actual fix was switching `MODEL_ID` to **`stepfun-ai/GOT-OCR-2.0-hf`** — a separate repo with a *native* transformers integration (`model_type: got_ocr2`, `GotOcr2ForConditionalGeneration`) that needs no `trust_remote_code` and none of the extra deps from point 3 (kept in `requirements.txt` anyway since they're harmless and avoid a second rebuild if a future model swap needs them).
5. `recognize()` decoded the full `generate()` output including the echoed chat-template prompt (`"system\n...user\n...assistant\n"` ahead of the actual text) — fixed by slicing off the input token length before `processor.decode()`.

With all five fixed, a direct sidecar call and a full round-trip through `app/api/v1/sources/extract` both correctly recognized text from a synthetic test image ("scanned page placeholder"). See OCR-0 for the latency figures that came out of the same test run.
**Verified:** `ocr/tests/test_main.py` (4 tests, passing) exercises `/health`, empty-body rejection, non-PDF rejection, and a full round-trip against `StubEngine`. `GotOcr2Engine` verified manually end-to-end (direct sidecar call + full-stack `extract` route call) — not covered by the automated test suite, since it requires real model weights and several minutes per call.

### OCR-4 — Wire extract-route fallback — **done**
`app/api/v1/sources/extract/route.ts`: computes chars-per-page after `pdf-parse` runs; below `OCR_TEXT_DENSITY_THRESHOLD` (or zero text), calls the sidecar (`lib/ocr/client.ts`) instead of throwing `EMPTY_DOCUMENT` outright — but only when `OCR_ENABLED` is set, so branches/deployments without the sidecar keep today's exact behavior. Reuses the existing `{ text, numpages }` shape, so downstream `fastLlm` structuring is untouched. Response now includes `source: "text-layer" | "ocr"`.
**Verified:** `npx tsc --noEmit` and `npx eslint` clean on the changed files; `lib/ocr/__tests__/client.test.ts` (4 tests, passing) covers the success path, missing-field defaults, sidecar-unreachable, and non-2xx cases. **Also verified 2026-07-13:** an actual end-to-end request through a running `docker compose` stack, against both `stub` (`source: "ocr"`, stub marker text, plus a typed-PDF regression check confirming `source: "text-layer"` still fires correctly) and `got-ocr2` (see OCR-0/OCR-3) engines.

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

Items 1–3 below (originally blocked on network access) are **done** as of 2026-07-13 — see OCR-0/OCR-3.

1. ~~Run OCR-0's benchmark for real against `GotOcr2Engine` on representative hardware; confirm/revise the synchronous route design.~~ Done — no-go on the synchronous design as-is; needs to become async.
2. ~~Smoke-test `GotOcr2Engine` directly — verify the `AutoProcessor`/`AutoModelForImageTextToText` calls actually produce sane text.~~ Done, after fixing 5 bugs (wrong model repo, missing deps, decode bug — see OCR-3).
3. ~~Run `OCR_ENGINE=got-ocr2` end-to-end through the notebook UI/API against the live Docker stack.~~ Done via direct sidecar call and full `POST /api/v1/sources/extract` round-trip.

Still open:

4. **Rework OCR-4/OCR-5 for async**: at ~3.6+ min/page CPU inference, the current synchronous request/response design (bounded by `OCR_TIMEOUT_MS`) isn't viable for real usage — needs a job-based flow (submit → poll/webhook) before this ships beyond manual testing.
5. OCR-6: tune `OCR_TEXT_DENSITY_THRESHOLD` against real scanned/handwritten samples (only a synthetic rendered-text image has been tried so far — real handwriting accuracy is still unverified) and collect the full ≥5-page average+p95 latency figure OCR-0's acceptance criteria originally asked for.
6. OCR-5's UI-facing half: decide how `source: "ocr"` should surface to the user (banner, badge, etc.) and implement it.

## Definition of Done (sprint-level)

- `docker compose --profile local-dev up` brings up the `ocr` service alongside existing services with no manual steps beyond `.env` config.
- Uploading a handwritten/scanned PDF through the notebook UI succeeds and produces a structured note instead of an `EMPTY_DOCUMENT` error.
- Existing typed-text PDF ingestion is unaffected (no regression).
- `.env.example`, `docker-compose.yml` docs/comments, and both OCR docs in `docs/` reflect the shipped implementation, not just the plan.

## Risks Carried Into the Sprint

- **CPU latency — confirmed, not hypothetical.** OCR-0's measured ~3.6+ min/page steady-state (worse on a cold container) means OCR-4/OCR-5's synchronous design does not hold as shipped; treat the async rework in "Remaining Work" as required, not optional, before any real usage beyond manual testing.
- **Model weight packaging**: baking multi-hundred-MB weights into the `ocr` image affects Docker image size/build time — decide in OCR-1, don't defer.
- **Non-English handwriting accuracy** is unverified and explicitly not a goal this sprint — scope validation (OCR-6) to English samples.

## Explicitly Out of Scope This Sprint

- GPU-tier model swap (OCR-7 — backlog for a future sprint once the CPU path is proven).
- Any OCR support on `main`/Vercel (no PyTorch runtime available in serverless; separate research needed if ever required).
