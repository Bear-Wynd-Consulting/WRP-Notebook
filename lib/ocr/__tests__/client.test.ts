import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { ocrExtractText, OcrUnavailableError } from "../client.ts";

describe("ocrExtractText", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("returns text and numpages on a successful response", async () => {
    global.fetch = (async () =>
      new Response(JSON.stringify({ text: "hello", numpages: 2 }), {
        status: 200,
      })) as typeof fetch;

    const result = await ocrExtractText(Buffer.from("pdf bytes"));
    assert.strictEqual(result.text, "hello");
    assert.strictEqual(result.numpages, 2);
  });

  test("defaults missing fields to empty text and zero pages", async () => {
    global.fetch = (async () =>
      new Response(JSON.stringify({}), { status: 200 })) as typeof fetch;

    const result = await ocrExtractText(Buffer.from("pdf bytes"));
    assert.strictEqual(result.text, "");
    assert.strictEqual(result.numpages, 0);
  });

  test("throws OcrUnavailableError when the sidecar is unreachable", async () => {
    global.fetch = (async () => {
      throw new Error("connect ECONNREFUSED");
    }) as typeof fetch;

    await assert.rejects(
      () => ocrExtractText(Buffer.from("pdf bytes")),
      OcrUnavailableError
    );
  });

  test("throws OcrUnavailableError on a non-2xx response", async () => {
    global.fetch = (async () =>
      new Response("boom", { status: 500 })) as typeof fetch;

    await assert.rejects(
      () => ocrExtractText(Buffer.from("pdf bytes")),
      OcrUnavailableError
    );
  });
});
