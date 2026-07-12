"""OCR engine abstraction.

`recognize()` takes rasterized page images and returns extracted text. The
model-loading code path (GotOcr2Engine) is untested in this repo's CI/sandbox
environment — it needs network access to Hugging Face to download weights,
which was unavailable when this sidecar was built (see
docs/ocr-handwritten-pdf-evaluation.md and the OCR-0 ticket in
docs/ocr-handwritten-pdf-sprint-plan.md). Whoever runs this on real hardware
should smoke-test GotOcr2Engine directly before flipping OCR_ENGINE=got-ocr2
in production, and fill in the CPU latency numbers OCR-0 was meant to produce.

StubEngine exists so the FastAPI plumbing, rasterization, and the extract-route
integration can all be built and tested end-to-end without model weights.
"""

from abc import ABC, abstractmethod

from PIL import Image


class OcrEngine(ABC):
    @abstractmethod
    def recognize(self, images: list[Image.Image]) -> str:
        """Return extracted text for a sequence of page images, in order."""


class StubEngine(OcrEngine):
    """Deterministic placeholder — no model weights, no network access.

    Returns empty text for blank-looking input and a marker string otherwise,
    so integration tests can assert on OCR having "run" without asserting on
    real handwriting-recognition output.
    """

    def recognize(self, images: list[Image.Image]) -> str:
        if not images:
            return ""
        return "\n\n".join(f"[stub-ocr page {i + 1}]" for i in range(len(images)))


class GotOcr2Engine(OcrEngine):
    """Real engine: stepfun-ai/GOT-OCR2_0 via transformers.

    NOT exercised by this repo's test suite — instantiating this class
    downloads ~1-2GB of weights from Hugging Face on first use. Load lazily
    (in __init__, not at import time) so importing this module never triggers
    a network call.
    """

    MODEL_ID = "stepfun-ai/GOT-OCR2_0"

    def __init__(self) -> None:
        import torch
        from transformers import AutoModelForImageTextToText, AutoProcessor

        self._torch = torch
        self._device = "cuda" if torch.cuda.is_available() else "cpu"
        self._processor = AutoProcessor.from_pretrained(self.MODEL_ID)
        self._model = AutoModelForImageTextToText.from_pretrained(
            self.MODEL_ID, dtype=torch.float32
        ).to(self._device)
        self._model.eval()

    def recognize(self, images: list[Image.Image]) -> str:
        page_texts = []
        for image in images:
            inputs = self._processor(image, return_tensors="pt").to(self._device)
            with self._torch.no_grad():
                generated = self._model.generate(**inputs, max_new_tokens=1024)
            page_texts.append(
                self._processor.decode(generated[0], skip_special_tokens=True)
            )
        return "\n\n".join(page_texts)


def load_engine(engine_name: str) -> OcrEngine:
    if engine_name == "stub":
        return StubEngine()
    if engine_name == "got-ocr2":
        return GotOcr2Engine()
    raise ValueError(f"Unknown OCR_ENGINE: {engine_name!r}")
