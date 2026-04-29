import { test, describe } from "node:test";
import assert from "node:assert";
import { batchForEmbedding, AI_LIMITS } from "../cost-guard.ts";

describe("batchForEmbedding", () => {
  test("Empty array should return empty batches", () => {
    const emptyResult = batchForEmbedding([]);
    assert.strictEqual(emptyResult.length, 0);
  });

  test("Single item should return 1 batch", () => {
    const singleResult = batchForEmbedding([1]);
    assert.strictEqual(singleResult.length, 1);
    assert.strictEqual(singleResult[0].length, 1);
    assert.strictEqual(singleResult[0][0], 1);
  });

  test(`Exactly MAX_EMBEDDING_BATCH (${AI_LIMITS.MAX_EMBEDDING_BATCH}) items should return 1 batch`, () => {
    const max = AI_LIMITS.MAX_EMBEDDING_BATCH;
    const exactlyMaxItems = Array.from({ length: max }, (_, i) => i);
    const maxResult = batchForEmbedding(exactlyMaxItems);
    assert.strictEqual(maxResult.length, 1);
    assert.strictEqual(maxResult[0].length, max);
  });

  test("MAX_EMBEDDING_BATCH + 1 items should return 2 batches", () => {
    const max = AI_LIMITS.MAX_EMBEDDING_BATCH;
    const moreThanMaxItems = Array.from({ length: max + 1 }, (_, i) => i);
    const moreThanMaxResult = batchForEmbedding(moreThanMaxItems);
    assert.strictEqual(moreThanMaxResult.length, 2);
    assert.strictEqual(moreThanMaxResult[0].length, max);
    assert.strictEqual(moreThanMaxResult[1].length, 1);
  });

  test("Multiple full batches should return correct number of batches", () => {
    const max = AI_LIMITS.MAX_EMBEDDING_BATCH;
    const twoFullBatchesItems = Array.from({ length: max * 2 }, (_, i) => i);
    const twoFullBatchesResult = batchForEmbedding(twoFullBatchesItems);
    assert.strictEqual(twoFullBatchesResult.length, 2);
    assert.strictEqual(twoFullBatchesResult[0].length, max);
    assert.strictEqual(twoFullBatchesResult[1].length, max);
  });
});
