# OCR sidecar

FastAPI service for the `local_llm_docker` branch's handwritten/scanned-PDF
fallback. See `../docs/ocr-handwritten-pdf-evaluation.md` for the design
rationale and `../docs/ocr-handwritten-pdf-sprint-plan.md` for ticket status.

## Endpoints

- `GET /health` — `{ status, engine }`
- `POST /ocr` — body is raw PDF bytes; returns `{ text, numpages, pagesProcessed }`

## Engines (`OCR_ENGINE` env var)

- `stub` (default) — no model weights, no network access. Returns a
  deterministic placeholder per page. Used by the test suite and for wiring
  up the rest of the stack before real weights are available.
- `got-ocr2` — loads `stepfun-ai/GOT-OCR-2.0-hf` via `transformers`
  (`AutoModelForImageTextToText`/`AutoProcessor`, no `trust_remote_code`
  needed — this repo has a native transformers integration, unlike
  `stepfun-ai/GOT-OCR2_0` without the `-hf` suffix, which ships legacy custom
  modeling code that current `transformers` doesn't know how to map to
  `AutoModelForImageTextToText`). Verified manually end-to-end on 2026-07-13
  (direct sidecar call and a full `POST /api/v1/sources/extract` round-trip)
  — not covered by the automated test suite, since it needs real model
  weights and takes several minutes per call. **Confirmed too slow for the
  current synchronous request design**: CPU inference measured ~3.6+ min/page
  once the model is loaded in the running process (longer — several minutes
  more — on the first request after a container start/rebuild, which also
  downloads and loads the ~1-2GB of weights). `lib/ocr/client.ts`'s
  `OCR_TIMEOUT_MS` (60s default) will abort a real request well before this
  completes; raise it substantially for manual testing, and see
  `docs/ocr-handwritten-pdf-sprint-plan.md` ("Remaining Work") for the async
  rework this implies before real usage.

## Running tests locally

```bash
pip install -r requirements.txt
python -m pytest tests/ -v
```

Tests only exercise the `stub` engine and rasterization — no download
required.
