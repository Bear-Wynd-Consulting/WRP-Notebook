import fitz

from app.rasterize import rasterize_pdf


def _make_pdf(num_pages: int) -> bytes:
    doc = fitz.open()
    try:
        for i in range(num_pages):
            page = doc.new_page()
            page.insert_text((72, 72), f"page {i + 1}")
        return doc.tobytes()
    finally:
        doc.close()


def test_rasterize_single_page():
    images, total_pages = rasterize_pdf(_make_pdf(1))
    assert total_pages == 1
    assert len(images) == 1
    assert images[0].mode == "L"  # grayscale


def test_rasterize_multi_page():
    images, total_pages = rasterize_pdf(_make_pdf(5))
    assert total_pages == 5
    assert len(images) == 5


def test_rasterize_respects_max_pages_cap():
    images, total_pages = rasterize_pdf(_make_pdf(30), max_pages=20)
    assert total_pages == 30
    assert len(images) == 20


def test_rasterize_dpi_affects_image_size():
    low_dpi_images, _ = rasterize_pdf(_make_pdf(1), dpi=72)
    high_dpi_images, _ = rasterize_pdf(_make_pdf(1), dpi=200)
    assert high_dpi_images[0].size[0] > low_dpi_images[0].size[0]
