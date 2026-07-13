"""PDF-to-image rasterization for the OCR sidecar.

Uses PyMuPDF (fitz) directly rather than shelling out to poppler's pdftoppm —
one pip dependency, no system package, and pages render straight to Pillow
images in-process. See docs/ocr-handwritten-pdf-evaluation.md for why this
was chosen over pdfjs-dist+sharp in Node.
"""

import io

import fitz  # PyMuPDF
from PIL import Image

DEFAULT_DPI = 200
DEFAULT_MAX_PAGES = 20


def rasterize_pdf(
    pdf_bytes: bytes,
    dpi: int = DEFAULT_DPI,
    max_pages: int = DEFAULT_MAX_PAGES,
) -> tuple[list[Image.Image], int]:
    """Render a PDF's pages to grayscale Pillow images.

    Returns (images, total_page_count). `images` is capped at `max_pages`
    even when the document has more — callers should surface that the
    document was truncated rather than silently dropping pages.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        total_pages = doc.page_count
        zoom = dpi / 72  # PDF units are 72 dpi by definition
        matrix = fitz.Matrix(zoom, zoom)

        images: list[Image.Image] = []
        for page_index in range(min(total_pages, max_pages)):
            page = doc[page_index]
            pix = page.get_pixmap(matrix=matrix, colorspace=fitz.csGRAY)
            image = Image.open(io.BytesIO(pix.tobytes("png")))
            images.append(image)

        return images, total_pages
    finally:
        doc.close()
