# OCR for Handwritten PDFs on `local_llm_docker` — Evaluation & Recommendation

## Context

`local_llm_docker` is the self-hosted deployment mode for WRP Notebook: Docker Compose runs a local Postgres+pgvector, a `wsproxy` shim, and an `llmster` service (LM Studio) serving small local models (`gemma-4-2b-it` chat, `embedding-gemma-300m` embeddings) via an OpenAI-compatible API. It replaces Inngest/Vercel Blob with a synchronous, in-memory PDF flow (`app/api/v1/sources/extract/route.ts`): `pdf-parse` extracts the text layer, then the local LLM structures it into Editor.js JSON.

This branch has no OCR today. Scanned or handwritten PDFs have no text layer, so `pdf-parse` returns empty text and the route throws `EMPTY_DOCUMENT` — the branch's own README already tells users to "try OCR" as a workaround that doesn't exist yet. The property management app is expected to ingest handwritten inspection/maintenance notes, so this gap sits directly in the way of that use case. This document evaluates whether an open-source OCR/VLM tool can close that gap while staying inside this branch's design philosophy (small, CPU-friendly, Docker-native, GPU optional), and sizes the work for sprint planning.

## Options Reviewed

| Tool | Type | License | Handwriting fit | Footprint |
|---|---|---|---|---|
| Tesseract | Classic OCR | Apache 2.0 | Poor (~45% acc.) | Tiny, CPU |
| EasyOCR | Classic OCR | Apache 2.0 | Weak (~62%) | Small, CPU |
| PaddleOCR | Classic OCR | Apache 2.0 | Weak-moderate (~73%, print-leaning) | Moderate, CPU |
| TrOCR (Microsoft) | Transformer recognizer | MIT | Purpose-built for handwriting (IAM CER 2.9–3.4%) | 62M–558M params, CPU-feasible, **but recognition-only** — needs a separate line/word detector paired in front of it |
| Surya | VLM-style detector/layout | Apache 2.0 code / modified OpenRail-M weights | Not designed for handwriting (printed text only) | Useful only as a layout/detector stage, not as the recognizer |
| **GOT-OCR2.0** | Unified end-to-end VLM | **Apache 2.0** | Explicit handwriting training (IAM, CASIA-HWDB2, NorHand-v3) | **580M params, <3GB VRAM, CPU-feasible**, no separate detector needed |
| olmOCR-2 / Qwen2.5-VL-7B | Large VLM | Apache 2.0 | Best-in-class on messy/handwritten docs (olmOCR-Bench 82.4, trained on 20k handwritten pages) | 7B params, needs GPU (~8–16GB VRAM) |

**Verdict: feasible.** GOT-OCR2.0 is the right default — it matches this branch's "small local model" philosophy (same spirit as `gemma-4-2b-it`/`embedding-gemma-300m`), is Apache 2.0 (no licensing friction), needs no separate detection stage, and runs on CPU. olmOCR/Qwen2.5-VL-7B is a credible upgrade path for shops running the GPU-enabled `phase2` profile, offered as an optional tier rather than the default.

## Recommended Integration Design

- **New Docker service `ocr`**: a small Python FastAPI/uvicorn sidecar (own Dockerfile, `python:3.11-slim` + `torch`/`transformers`/`pymupdf`/`fastapi`), not folded into `llmster`. LM Studio only serves OpenAI-compatible chat/embeddings endpoints; GOT-OCR2.0 needs a custom image-in/text-out contract and PDF rasterization, which doesn't fit that shape. The sidecar is added to all three existing compose profiles (`local-dev`, `phase2`, `ai-pc`) for the CPU-friendly default tier.
- **Rasterization inside the sidecar** via PyMuPDF (`fitz`) — one pip dependency, no poppler system package, renders pages in-process at ~200 DPI, capped page count to bound latency. Keeps the PDF bytes → image → text pipeline in one process instead of shipping image buffers between Next.js and the sidecar.
- **Pipeline hook**: in `app/api/v1/sources/extract/route.ts`, after `pdf-parse` runs, compute characters-per-page. Below a tunable threshold (`OCR_TEXT_DENSITY_THRESHOLD`), call the `ocr` sidecar instead of throwing `EMPTY_DOCUMENT`. The OCR path returns the same `{ text, numpages }` shape `pdf-parse` does, so the existing "structure with `fastLlm`" step downstream needs no changes. Tag the response with `source: "text-layer" | "ocr"` so the UI can flag OCR'd documents for review.
- **GPU upgrade path**: `OCR_MODEL_TIER=gpu` env flag swaps the sidecar's loaded weights to Qwen2.5-VL-7B/olmOCR-2, gated behind the existing `phase2` GPU profile (same NVIDIA Container Toolkit dependency `llmster` already requires in that profile). Ship as a follow-up ticket, not in the initial cut.
- **Explicitly out of scope**: `main`/Vercel has no path to run a PyTorch OCR model in a serverless function. If handwritten-PDF support is ever needed on the cloud/production stack, that requires separate research (e.g. a hosted OCR/vision API) — not solved by this Docker-based work.

## Sprint-Sized Task Breakdown

1. **Scaffold `ocr` sidecar** — FastAPI app, Dockerfile, health endpoint, `docker-compose.yml` service + profile wiring, `.env.example` additions (`OCR_BASE_URL`, `OCR_ENABLED`, `OCR_TEXT_DENSITY_THRESHOLD`).
2. **Rasterization** — PyMuPDF page-to-image conversion, page-count cap, basic contrast/grayscale normalization.
3. **Model integration** — load GOT-OCR2.0 weights, implement `/ocr` POST endpoint (PDF bytes in → `{ text, numpages }` out).
4. **Wire fallback logic** — density check + conditional OCR call in `extract/route.ts`, replacing the hard `EMPTY_DOCUMENT` throw; add `source` marker.
5. **Error handling** — sidecar unreachable, or OCR still returns empty (genuinely blank page); decide UX (partial-success banner vs. hard error).
6. **Validation** — test against real handwritten scans (cursive, mixed print/cursive, multi-page); benchmark CPU latency/page (currently unknown — the main open risk); tune the density threshold.
7. **Stretch/follow-up** — GPU-tier Qwen2.5-VL/olmOCR swap behind `phase2`; re-confirm license terms for those weights at ship time.

**Key risks to flag in planning**: CPU OCR latency per page is unbenchmarked and could push a multi-page document past a reasonable synchronous HTTP timeout (may need to revisit the "synchronous in-memory" pattern this branch otherwise uses, e.g. polling/async for OCR specifically); GOT-OCR2.0 accuracy on non-English handwriting is unverified; the sidecar adds a new failure domain to an already multi-container compose stack.

### Files most relevant to implementation

- `app/api/v1/sources/extract/route.ts` — extraction/fallback hook point
- `docker-compose.yml` — new `ocr` service + profile wiring
- `lib/ai/providers.ts` — existing pattern for env-driven local-service switching, to mirror for `OCR_BASE_URL`
- `lib/security/file-upload.ts` — existing MAX_FILE_SIZE/magic-byte validation pattern to mirror for sidecar input
- `.env.example` — new env vars

(All of the above live on the `local_llm_docker` branch, not `main`.)

## Verification (once implemented)

- `docker compose --profile local-dev up` with the new `ocr` service; upload a scanned/handwritten PDF via the notebook UI and confirm it no longer errors with `EMPTY_DOCUMENT`.
- Compare OCR output against a hand-transcribed sample to sanity-check accuracy before trusting it for real intake.
- Confirm plain-text-layer PDFs are unaffected (density check doesn't false-positive on normal typed PDFs).
