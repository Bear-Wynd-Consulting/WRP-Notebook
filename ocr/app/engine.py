"""OCR engine abstraction.

`recognize()` takes rasterized page images and returns extracted text.
GotOcr2Engine is not covered by this repo's automated test suite — it needs
real model weights and takes several minutes per call — but has been run
manually end-to-end (see docs/ocr-handwritten-pdf-sprint-plan.md, OCR-0/OCR-3).
CPU inference is confirmed too slow for the current synchronous request
design; see that doc's "Remaining Work" for the implied async rework.

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
    """Real engine: stepfun-ai/GOT-OCR-2.0-hf via transformers.

    Not covered by this repo's automated test suite — instantiating this class
    downloads ~1-2GB of weights from Hugging Face on first use, and CPU
    inference measured ~3.6+ min/page even once loaded. Load lazily
    (in __init__, not at import time) so importing this module never triggers
    a network call.
    """

    # The "-hf" repo has a native transformers integration (model_type
    # "got_ocr2", GotOcr2ForConditionalGeneration/GotOcr2Config) — no
    # trust_remote_code needed. stepfun-ai/GOT-OCR2_0 (no "-hf" suffix) only
    # ships legacy custom modeling code whose GOTConfig class
    # AutoModelForImageTextToText doesn't recognize.
    MODEL_ID = "stepfun-ai/GOT-OCR-2.0-hf"

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
            input_length = inputs["input_ids"].shape[1]
            with self._torch.no_grad():
                generated = self._model.generate(**inputs, max_new_tokens=1024)
            # generate() returns the prompt tokens followed by the new ones —
            # decoding the full sequence echoes the chat-template prompt
            # ("system\n...user\n...assistant\n") ahead of the actual OCR text.
            page_texts.append(
                self._processor.decode(generated[0, input_length:], skip_special_tokens=True)
            )
        return "\n\n".join(page_texts)


def load_engine(engine_name: str) -> OcrEngine:
    if engine_name == "stub":
        return StubEngine()
    if engine_name == "got-ocr2":
        return GotOcr2Engine()
    raise ValueError(f"Unknown OCR_ENGINE: {engine_name!r}")
