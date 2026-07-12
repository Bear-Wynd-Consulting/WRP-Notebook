/**
 * Client for the `ocr` sidecar (local_llm_docker's Compose service — see
 * docs/ocr-handwritten-pdf-evaluation.md). Mirrors the env-gated style of
 * lib/ai/llm-client.ts: no client is instantiated when OCR is disabled.
 */

export const OCR_ENABLED = process.env.OCR_ENABLED === "true";

const OCR_BASE_URL = process.env.OCR_BASE_URL ?? "http://ocr:8000";
const OCR_TIMEOUT_MS = parseInt(process.env.OCR_TIMEOUT_MS ?? "60000");

export interface OcrResult {
  text: string;
  numpages: number;
}

/** Thrown when the sidecar can't be reached or returns a non-2xx status. */
export class OcrUnavailableError extends Error {}

export async function ocrExtractText(pdfBytes: Buffer): Promise<OcrResult> {
  let response: Response;
  try {
    response = await fetch(`${OCR_BASE_URL}/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: new Uint8Array(pdfBytes),
      signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
    });
  } catch (err) {
    throw new OcrUnavailableError(
      `OCR service unreachable: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!response.ok) {
    throw new OcrUnavailableError(`OCR service returned ${response.status}`);
  }

  const body = (await response.json()) as { text?: string; numpages?: number };
  return { text: body.text ?? "", numpages: body.numpages ?? 0 };
}
