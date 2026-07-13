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
- `got-ocr2` — loads `stepfun-ai/GOT-OCR2_0` via `transformers`. **Not
  exercised by this repo's tests or by whoever built this sidecar** — the
  sandbox this was built in had no network access to Hugging Face
  (`huggingface.co` and `download.pytorch.org` were both blocked by egress
  policy). Before flipping `OCR_ENGINE=got-ocr2` in `docker-compose.yml`,
  someone with normal network access needs to:
  1. Build the image and let it download weights on first `/ocr` call.
  2. Confirm `GotOcr2Engine` in `app/engine.py` actually produces sane text
     on a real handwritten page (the processor/model API calls there are
     written from the HF model card, not verified against a live run).
  3. Measure seconds/page on representative hardware — this is ticket OCR-0
     in the sprint plan, still open.

## Running tests locally

```bash
pip install -r requirements.txt
python -m pytest tests/ -v
```

Tests only exercise the `stub` engine and rasterization — no download
required.
