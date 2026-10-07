// P11 probe for read-batch: one reply about a batch into a Batch Read by docs/TASK_P11_processor.md §2.2 — the error
// reads (http, unreadable, provider error), the state words (done, failed for failed/expired/cancelled/canceled/
// cancelling, else pending), the results mapped to Replies in the provider's order through Read Response, item errors.
// Record Read Batch examples 1-5, then the §2.2 rows.
import { test, expect, expectTypeOf } from "vitest";
import { readBatch } from "../../src/processor/batchResponse.js";
import type { BatchRead, BatchState } from "../../src/processor/batchResponse.js";
import type { Reply } from "../../src/processor/types.js";
import { fixture } from "../../tests/helpers.js";

const ID = "batch-1789576284-Ejahe4wq9AgVdp5xGdNm";
const zero = (customId: string) => ({ customId, inputTokens: 0, outputTokens: 0, cost: null, provider: null, generationId: null });
const obj = (status: unknown, extra: Record<string, unknown> = {}): string => JSON.stringify({ id: ID, status, results: null, error: null, ...extra });

test("Read Batch example 1: a submit's answer is pending", () => {
  expect(readBatch(202, fixture("processor/batchSubmitted.json"))).toStrictEqual(
    { batchId: ID, state: "pending", status: "validating", error: null, replies: [] });
});

test("Read Batch example 2: a completed batch, results in the provider's order", () => {
  const got = readBatch(200, fixture("processor/batchCompleted.json"));
  expect(`${got.batchId} ${got.state} ${got.status} ${got.error}`, "head").toBe(`${ID} done completed null`);
  expect(got.replies.map((r) => r.answer.customId).join(","), "order").toBe("c.v1,a.v1,b.v1");
  expect(got.replies[0], "c.v1").toStrictEqual({
    answer: { customId: "c.v1", text: null, finishReason: null, error: "batch item error: context length exceeded" }, usage: zero("c.v1") });
  expect(got.replies[1], "a.v1").toStrictEqual({
    answer: { customId: "a.v1", text: "```ts\nexport const a = 1;\n```", finishReason: "stop", error: null },
    usage: { customId: "a.v1", inputTokens: 11030, outputTokens: 571, cost: 0.00269316, provider: "Novita", generationId: "gen-0000000003-TESTtestTESTtestTEST" } });
  expect(got.replies[2], "b.v1").toStrictEqual({
    answer: { customId: "b.v1", text: null, finishReason: "length", error: null },
    usage: { customId: "b.v1", inputTokens: 15550, outputTokens: 12000, cost: 0.0086, provider: "Novita", generationId: "gen-0000000004-TESTtestTESTtestTEST" } });
});

test("Read Batch example 3: a batch the provider rejected after accepting it", () => {
  expect(readBatch(200, fixture("processor/batchFailed.json"))).toStrictEqual({ batchId: ID, state: "failed", status: "failed",
    error: "HTTP 400: invalid batch inference job: job-submission-count for account acct-0000, in use: 16, quota: 16", replies: [] });
});

test("Read Batch example 4: 404 is an error read", () => {
  expect(readBatch(404, fixture("processor/batchNotFound.json"))).toStrictEqual({ batchId: null, state: "error", status: null,
    error: "http 404: Batch job " + ID + " not found.", replies: [] });
});

test("Read Batch example 5: a 2xx body that is not JSON", () => {
  expect(readBatch(200, "<html>bad gateway</html>")).toStrictEqual({ batchId: null, state: "error", status: null,
    error: "unreadable response: <html>bad gateway</html>", replies: [] });
});

test("Read Batch rows: the state words", () => {
  const state = (s: string): string => readBatch(200, obj(s)).state;
  expect(["completed", "failed", "expired", "cancelled", "canceled", "cancelling", "validating", "in_progress", "finalizing", "x"]
    .map(state).join(","), "states").toBe("done,failed,failed,failed,failed,failed,pending,pending,pending,pending");
  expect(readBatch(200, fixture("processor/batchInProgress.json")).status, "in_progress").toBe("in_progress");
  expect(readBatch(200, JSON.stringify({ status: "completed" })).batchId, "no id").toBe(null);
});

test("Read Batch rows: error reads", () => {
  expect(readBatch(500, "x".repeat(300)).error, "http text cut at 200").toBe("http 500: " + "x".repeat(200));
  expect(readBatch(200, "[1]").error, "array").toBe("unreadable response: [1]");
  expect(readBatch(200, "{}").error, "no status").toBe("provider error: no batch status");
  expect(readBatch(200, JSON.stringify({ error: { message: "quota" } })), "no status, an error").toStrictEqual(
    { batchId: null, state: "error", status: null, error: "provider error: quota", replies: [] });
  expect(readBatch(200, JSON.stringify({ status: 3 })).state, "status not a string").toBe("error");
});

test("Read Batch rows: entries — skipped, item errors, status_code, missing response", () => {
  const got = readBatch(200, obj("completed", { results: [
    { custom_id: 7, response: null, error: null },
    "junk",
    { custom_id: "e1", response: null, error: "boom" },
    { custom_id: "e2", response: null, error: null },
    { custom_id: "e3", response: { status_code: 500, body: { error: { message: "internal" } } }, error: null },
    { custom_id: "e4", response: { body: { choices: [] } }, error: null },
    { custom_id: "e5", response: { body: { choices: [{ finish_reason: "stop", message: { content: "ok" } }] } } },
  ] }));
  expect(got.replies.map((r) => `${r.answer.customId}=${r.answer.error ?? r.answer.text}`), "replies").toStrictEqual([
    'e1=batch item error: "boom"', "e2=batch item error: no response", "e3=http 500: internal",
    "e4=provider error: no choices", "e5=ok"]);
  expect(got.replies[0]?.usage, "item error usage").toStrictEqual(zero("e1"));
  expect(readBatch(200, obj("in_progress", { results: "x" })).replies, "results not an array").toStrictEqual([]);
});

test("Read Batch rows: the Batch Read type", () => {
  expectTypeOf<BatchState>().toEqualTypeOf<"pending" | "done" | "failed" | "error">();
  expectTypeOf<BatchRead>().toEqualTypeOf<{ batchId: string | null; state: BatchState; status: string | null; error: string | null; replies: Reply[] }>();
  expectTypeOf(readBatch).toEqualTypeOf<(status: number, text: string) => BatchRead>();
});
