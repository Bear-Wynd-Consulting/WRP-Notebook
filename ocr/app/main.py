"""OCR sidecar for local_llm_docker.

POST /ocr takes raw PDF bytes and returns extracted text — a drop-in
replacement for pdf-parse's output shape so app/api/v1/sources/extract/route.ts
doesn't need to change its downstream handling. See
docs/ocr-handwritten-pdf-evaluation.md for the design this implements.
"""

import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app.engine import OcrEngine, load_engine
from app.rasterize import DEFAULT_DPI, DEFAULT_MAX_PAGES, rasterize_pdf

app = FastAPI(title="wrp-notebook-ocr")

_engine: OcrEngine | None = None


def get_engine() -> OcrEngine:
    global _engine
    if _engine is None:
        _engine = load_engine(os.environ.get("OCR_ENGINE", "stub"))
    return _engine


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "engine": os.environ.get("OCR_ENGINE", "stub")}


@app.post("/ocr")
async def ocr(request: Request) -> JSONResponse:
    pdf_bytes = await request.body()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Empty request body")

    max_pages = int(os.environ.get("OCR_MAX_PAGES", DEFAULT_MAX_PAGES))
    dpi = int(os.environ.get("OCR_DPI", DEFAULT_DPI))

    try:
        images, total_pages = rasterize_pdf(pdf_bytes, dpi=dpi, max_pages=max_pages)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read PDF: {exc}") from exc

    text = get_engine().recognize(images)

    return JSONResponse(
        {
            "text": text,
            "numpages": total_pages,
            "pagesProcessed": len(images),
        }
    )
