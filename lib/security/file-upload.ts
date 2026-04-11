/**
 * File upload validation.
 *
 * Validates by magic bytes (not Content-Type header, which can be spoofed).
 * Enforces per-type MIME allowlists and a global 50MB size cap.
 */

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// Allowed MIME types per source type
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm"],
  text: ["text/plain", "text/markdown", "text/csv"],
};

// Magic byte signatures — (offset, bytes)
const MAGIC_BYTES: Array<{ mime: string; offset: number; bytes: number[] }> = [
  { mime: "application/pdf", offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "audio/mpeg", offset: 0, bytes: [0xff, 0xfb] }, // MP3
  { mime: "audio/mpeg", offset: 0, bytes: [0xff, 0xf3] }, // MP3 (alt)
  { mime: "audio/mpeg", offset: 0, bytes: [0xff, 0xf2] }, // MP3 (alt)
  { mime: "audio/mpeg", offset: 0, bytes: [0x49, 0x44, 0x33] }, // MP3 ID3
  { mime: "audio/wav", offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF (WAV)
  { mime: "audio/ogg", offset: 0, bytes: [0x4f, 0x67, 0x67, 0x53] }, // OggS
  { mime: "audio/mp4", offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // ftyp (M4A/MP4)
  { mime: "audio/webm", offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }, // EBML (WebM)
  { mime: "text/plain", offset: 0, bytes: [] }, // fallback — text has no magic bytes
];

function detectMimeFromMagicBytes(buffer: Buffer): string {
  for (const sig of MAGIC_BYTES) {
    if (sig.bytes.length === 0) continue; // skip text fallback in loop
    if (buffer.length < sig.offset + sig.bytes.length) continue;
    const slice = Array.from(buffer.slice(sig.offset, sig.offset + sig.bytes.length));
    if (slice.every((b, i) => b === sig.bytes[i])) {
      return sig.mime;
    }
  }
  // Fallback: check if content looks like UTF-8 text
  try {
    buffer.slice(0, 512).toString("utf8");
    return "text/plain";
  } catch {
    return "application/octet-stream";
  }
}

/** Sanitize a filename for safe storage. */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 200);
}

export interface ValidatedUpload {
  safeName: string;
  detectedMimeType: string;
}

/**
 * Validate an uploaded file by size and magic-byte MIME detection.
 * Throws an Error with a safe message if validation fails.
 */
export async function validateUpload(
  file: File,
  sourceType: string
): Promise<ValidatedUpload> {
  // 1. Size check
  if (file.size > MAX_FILE_SIZE) {
    const limitMB = MAX_FILE_SIZE / 1024 / 1024;
    throw new Error(`File exceeds ${limitMB}MB limit`);
  }

  // 2. Magic-byte MIME detection
  const headerBytes = await file.slice(0, 16).arrayBuffer();
  const buffer = Buffer.from(headerBytes);
  const detectedMimeType = detectMimeFromMagicBytes(buffer);

  // 3. Allowlist check
  const allowed = ALLOWED_MIME_TYPES[sourceType];
  if (allowed && !allowed.includes(detectedMimeType)) {
    throw new Error(
      `File type ${detectedMimeType} is not allowed for source type "${sourceType}"`
    );
  }

  // 4. Filename sanitization
  const safeName = sanitizeFilename(file.name);

  return { safeName, detectedMimeType };
}
