import { expect, test } from "vitest";
import { readBatch } from "../../src/processor/batchResponse.js";
import { fixture, fixtureJson } from "../helpers.js";

// Examples 1-5 of Read Batch live in tests/processor/batchResponse.examples.test.ts.

const repliesJson = fixtureJson("processor/replies.json") as { live: unknown[] };

test("Read Batch example 6: a live completed batch names its cost and returns its two replies", () => {
  const read = readBatch(200, fixture("processor/batchCompletedLive.json"));
  expect(read.batchId).toBe("batch-1791388269-cp5qOr5IQ0xoz1ntuc8W");
  expect(read.state).toBe("done");
  expect(read.status).toBe("completed");
  expect(read.error).toBeNull();
  expect(read.cost).toBe(0.0005804);
  expect(read.replies).toStrictEqual(repliesJson.live);
});
