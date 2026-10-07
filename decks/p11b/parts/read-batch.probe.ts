// P11b probe for read-batch: the batch's own cost by docs/TASK_P11b_processor.md §2.2 (issue #4 item 1) — cost = the
// batch object's usage.cost when a number (0 included), else no cost key at all; the replies as before. Record Read
// Batch example 6, then the §2.2 rows.
import { test, expect, expectTypeOf } from "vitest";
import { readBatch } from "../../src/processor/batchResponse.js";
import type { BatchRead } from "../../src/processor/batchResponse.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

const LIVE = "batch-1791388269-cp5qOr5IQ0xoz1ntuc8W";
const withUsage = (name: string, usage: unknown): string =>
  JSON.stringify({ ...(JSON.parse(fixture("processor/" + name)) as Record<string, unknown>), usage });

test("Read Batch example 6: the live completed batch carries its cost, the replies none", () => {
  const got = readBatch(200, fixture("processor/batchCompletedLive.json"));
  expect(`${got.batchId} ${got.state} ${got.status} ${got.error}`, "head").toBe(LIVE + " done completed null");
  expect(got.cost, "cost").toBe(0.0005804);
  const replies = fixtureJson("processor/replies.json") as { live: unknown };
  expect(got.replies, "replies exactly replies.json[\"live\"]").toStrictEqual(replies.live);
  expect(got.replies.map((r) => `${r.answer.customId} ${r.usage.inputTokens}/${r.usage.outputTokens} ${r.usage.cost}`).join(", "),
    "replies").toBe("sign-of.v1 401/46 null, clamp-value.v1 431/57 null");
});

test("§2.2 rows: cost 0 is a cost; a string, a missing usage or an error read gives no cost key", () => {
  const zero = readBatch(200, withUsage("batchInProgress.json", { cost: 0 }));
  expect(`${zero.state} ${"cost" in zero} ${zero.cost}`, "cost 0").toBe("pending true 0");
  const half = readBatch(200, withUsage("batchCompleted.json", { cost: 0.5, prompt_tokens: 3 }));
  expect(`${half.state} ${half.cost} ${half.replies.length}`, "cost 0.5").toBe("done 0.5 3");
  expect("cost" in readBatch(200, withUsage("batchInProgress.json", { cost: "0.5" })), "a string").toBe(false);
  expect("cost" in readBatch(200, withUsage("batchInProgress.json", null)), "usage null").toBe(false);
  expect(readBatch(202, fixture("processor/batchSubmitted.json")), "no usage: Read Batch example 1 exactly").toStrictEqual({
    batchId: "batch-1789576284-Ejahe4wq9AgVdp5xGdNm", state: "pending", status: "validating", error: null, replies: [] });
  expect("cost" in readBatch(500, JSON.stringify({ usage: { cost: 1 } })), "an error read").toBe(false);
  expectTypeOf<BatchRead["cost"]>().toEqualTypeOf<number | undefined>();
});
