import fitz
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _make_pdf(num_pages: int = 1) -> bytes:
    doc = fitz.open()
    try:
        for i in range(num_pages):
            page = doc.new_page()
            page.insert_text((72, 72), f"page {i + 1}")
        return doc.tobytes()
    finally:
        doc.close()


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_ocr_rejects_empty_body():
    response = client.post("/ocr", content=b"")
    assert response.status_code == 400


def test_ocr_rejects_non_pdf_bytes():
    response = client.post("/ocr", content=b"not a pdf")
    assert response.status_code == 400


def test_ocr_returns_text_and_page_count_for_valid_pdf():
    response = client.post("/ocr", content=_make_pdf(3))
    assert response.status_code == 200
    body = response.json()
    assert body["numpages"] == 3
    assert body["pagesProcessed"] == 3
    assert "[stub-ocr page 1]" in body["text"]
    assert "[stub-ocr page 3]" in body["text"]
