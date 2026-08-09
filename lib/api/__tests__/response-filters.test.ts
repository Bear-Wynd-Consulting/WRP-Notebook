import { test, describe } from "node:test";
import assert from "node:assert";
import {
  toPublicNotebook,
  toPublicSource,
  toPublicNote,
  toPublicChatSession,
  toPublicChatMessage,
  toPublicApiKey
} from "../response-filters.ts";

describe("Response Filters", () => {
  describe("toPublicNotebook", () => {
    test("should return only public fields and omit internal ones", () => {
      const now = new Date();
      const notebook: any = {
        id: "nb_123",
        name: "Test Notebook",
        description: "A description",
        visibility: "PUBLIC",
        databases: ["db1"],
        ownerId: "user_456",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      const result = toPublicNotebook(notebook);

      assert.deepStrictEqual(result, {
        id: "nb_123",
        name: "Test Notebook",
        description: "A description",
        visibility: "PUBLIC",
        createdAt: now,
        updatedAt: now,
      });

      // Explicitly check for absence of internal fields
      assert.strictEqual((result as any).ownerId, undefined);
      assert.strictEqual((result as any).deletedAt, undefined);
      assert.strictEqual((result as any).databases, undefined);
    });
  });

  describe("toPublicSource", () => {
    test("should filter internal source fields", () => {
      const now = new Date();
      const source: any = {
        id: "src_123",
        type: "pdf",
        title: "Test Source",
        content: "Full content",
        summary: "Short summary",
        metadata: { author: "Me" },
        status: "READY",
        filePath: "/path/to/file",
        blobUrl: "https://blob.url/private",
        mimeType: "application/pdf",
        fileSize: 1024,
        uploadedBy: "user_456",
        createdAt: now,
        updatedAt: now,
      };

      const result = toPublicSource(source);

      assert.deepStrictEqual(result, {
        id: "src_123",
        type: "pdf",
        title: "Test Source",
        summary: "Short summary",
        status: "READY",
        mimeType: "application/pdf",
        fileSize: 1024,
        createdAt: now,
        updatedAt: now,
        documentType: null,
        contract: null,
      });

      assert.strictEqual((result as any).blobUrl, undefined);
      assert.strictEqual((result as any).uploadedBy, undefined);
      assert.strictEqual((result as any).content, undefined);
      assert.strictEqual((result as any).metadata, undefined);
      assert.strictEqual((result as any).filePath, undefined);
    });

    test("should expose whitelisted contract fields when documentType is contract", () => {
      const now = new Date();
      const contract = {
        tenantName: "Acme Corp",
        rentalRate: "$2,400.00",
        rentalFrequency: "monthly",
        leaseStartDate: "2025-01-01",
        leaseEndDate: "2026-12-31",
        unitIdentifier: "Suite 204",
        renewalTerms: "Automatic 1-year renewal unless 60-day notice given.",
        autoRenew: true,
        confidence: "high",
      };
      const source: any = {
        id: "src_456",
        type: "pdf",
        title: "Lease — Acme Corp",
        content: "Full lease text",
        summary: null,
        metadata: { documentType: "contract", contract },
        structured: { time: 1, blocks: [], version: "2.29.0" },
        status: "READY",
        filePath: null,
        blobUrl: "https://blob.url/private",
        mimeType: "application/pdf",
        fileSize: 2048,
        uploadedBy: "user_456",
        createdAt: now,
        updatedAt: now,
      };

      const result = toPublicSource(source);

      assert.deepStrictEqual(result, {
        id: "src_456",
        type: "pdf",
        title: "Lease — Acme Corp",
        summary: null,
        status: "READY",
        mimeType: "application/pdf",
        fileSize: 2048,
        createdAt: now,
        updatedAt: now,
        documentType: "contract",
        contract,
      });

      assert.strictEqual((result as any).blobUrl, undefined);
      assert.strictEqual((result as any).uploadedBy, undefined);
      assert.strictEqual((result as any).structured, undefined);
    });
  });

  describe("toPublicNote", () => {
    test("should filter internal note fields", () => {
      const now = new Date();
      const note: any = {
        id: "note_123",
        title: "Test Note",
        content: "Note content",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      const result = toPublicNote(note);

      assert.deepStrictEqual(result, {
        id: "note_123",
        title: "Test Note",
        content: "Note content",
        createdAt: now,
        updatedAt: now,
      });

      assert.strictEqual((result as any).deletedAt, undefined);
    });
  });

  describe("toPublicChatSession", () => {
    test("should return public chat session fields", () => {
      const now = new Date();
      const session: any = {
        id: "chat_123",
        notebookId: "nb_123",
        title: "Chat Title",
        createdAt: now,
        updatedAt: now,
      };

      const result = toPublicChatSession(session);

      assert.deepStrictEqual(result, {
        id: "chat_123",
        notebookId: "nb_123",
        title: "Chat Title",
        createdAt: now,
        updatedAt: now,
      });
    });
  });

  describe("toPublicChatMessage", () => {
    test("should return public chat message fields", () => {
      const now = new Date();
      const message: any = {
        id: "msg_123",
        chatSessionId: "chat_123",
        role: "user",
        content: "Hello",
        citations: [{ id: "chunk_1", snippet: "text" }],
        createdAt: now,
      };

      const result = toPublicChatMessage(message);

      assert.deepStrictEqual(result, {
        id: "msg_123",
        role: "user",
        content: "Hello",
        citations: [{ id: "chunk_1", snippet: "text" }],
        createdAt: now,
      });

      assert.strictEqual((result as any).chatSessionId, undefined);
    });
  });

  describe("toPublicApiKey", () => {
    test("should filter internal api key fields and never return keyHash", () => {
      const now = new Date();
      const key: any = {
        id: "key_123",
        name: "My Key",
        keyHash: "sha256hash",
        keyPrefix: "wrp_k1_123",
        scope: "EXTERNAL",
        permissions: ["read"],
        notebookIds: ["nb_123"],
        ownerId: "user_456",
        rateLimit: 100,
        expiresAt: null,
        lastUsedAt: now,
        lastUsedIp: "127.0.0.1",
        createdAt: now,
        revokedAt: null,
      };

      const result = toPublicApiKey(key);

      assert.deepStrictEqual(result, {
        id: "key_123",
        name: "My Key",
        keyPrefix: "wrp_k1_123",
        scope: "EXTERNAL",
        permissions: ["read"],
        notebookIds: ["nb_123"],
        rateLimit: 100,
        expiresAt: null,
        lastUsedAt: now,
        createdAt: now,
        revokedAt: null,
      });

      assert.strictEqual((result as any).keyHash, undefined);
      assert.strictEqual((result as any).ownerId, undefined);
      assert.strictEqual((result as any).lastUsedIp, undefined);
    });
  });
});
