/**
 * POST /api/v1/sources/extract
 *
 * Phase 1 of the two-phase PDF ingestion flow.
 * Accepts a PDF upload, parses it in-memory, and asks the local/cloud LLM to
 * structure it as Editor.js JSON. The file is never persisted — it is garbage
 * collected after this response. No Vercel Blob or Inngest required.
 *
 * Returns: { structuredData: OutputData, rawText: string }
 */
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth-config";
import { validateUpload } from "@/lib/security/file-upload";
import { handleApiError, apiError } from "@/lib/api/error-response";
import { AI_LIMITS } from "@/lib/ai/cost-guard";
import { llmClient, LLM_MODEL } from "@/lib/ai/llm-client";

const EXTRACTION_PROMPT = `You are an expert data extraction assistant. Convert the following raw text from a PDF into a structured JSON object compatible with Editor.js.

Output ONLY valid JSON — no markdown fences, no explanation, no preamble.

Required format:
{
  "time": <unix timestamp in milliseconds>,
  "blocks": [
    { "type": "header", "data": { "text": "Section Title", "level": 2 } },
    { "type": "paragraph", "data": { "text": "Paragraph content here." } },
    { "type": "list", "data": { "style": "unordered", "items": ["Item 1", "Item 2"] } }
  ],
  "version": "2.29.0"
}

Rules:
- Use "header" for headings and section titles (level 2 or 3)
- Use "paragraph" for body text
- Use "list" for enumerated or bullet items
- Preserve the logical document structure
- Omit page numbers, headers/footers, and artefacts

Raw text:
`;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("Authentication required", "UNAUTHORIZED", 401);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiError("No file provided", "VALIDATION_ERROR", 400);
    }

    // Magic-byte validation — never trust Content-Type
    await validateUpload(file, "pdf");

    // Parse PDF in-memory — file is never written to disk or blob storage
    const arrayBuffer = await file.arrayBuffer();
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: arrayBuffer });
    let rawText: string;
    try {
      const result = await parser.getText();
      rawText = result.text ?? "";
    } finally {
      await parser.destroy();
    }

    if (!rawText.trim()) {
      return apiError(
        "PDF contains no extractable text. Try a scanned PDF with OCR or use the Plain Text tab.",
        "EMPTY_DOCUMENT",
        422
      );
    }

    // Truncate to stay within local model context limits (local 7B models need tighter cap)
    const localContextLimit = Math.min(AI_LIMITS.MAX_SOURCE_TEXT_LENGTH, 15_000);
    const truncatedText = rawText.slice(0, localContextLimit);

    // Ask the LLM to structure the text as Editor.js JSON
    let structuredData: unknown;
    try {
      const message = await llmClient.messages.create({
        model: LLM_MODEL,
        max_tokens: 4000,
        temperature: 0.1,
        system: "You output strict, valid JSON only. No markdown formatting, no explanation, no prose.",
        messages: [
          {
            role: "user",
            content: `${EXTRACTION_PROMPT}${truncatedText}`,
          },
        ],
      });

      const responseText =
        message.content[0].type === "text" ? message.content[0].text.trim() : "";

      // Strip any accidental markdown fences the model adds
      const cleaned = responseText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      structuredData = JSON.parse(cleaned);
    } catch {
      // Fallback: return the raw text as a single paragraph block
      structuredData = {
        time: Date.now(),
        blocks: [{ type: "paragraph", data: { text: rawText } }],
        version: "2.29.0",
      };
    }

    return Response.json({ structuredData, rawText });
  } catch (err) {
    return handleApiError(err, "POST /api/v1/sources/extract");
  }
}
