FROM python:3.11-slim

WORKDIR /app

# libgl1/libglib2.0-0 satisfy Pillow/PyMuPDF's runtime image-decoding deps on slim.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

# OCR_ENGINE=got-ocr2 downloads model weights from Hugging Face on first run and
# caches them in HF_HOME (mount a volume there in docker-compose.yml to avoid
# re-downloading on every container recreate). OCR_ENGINE=stub needs no weights.
ENV HF_HOME=/root/.cache/huggingface

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
