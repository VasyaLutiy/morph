// P11b probe for send-batch: one generation as one OpenRouter batch by docs/TASK_P11b_processor.md §2.2 (issue #4
// items 1, 2 and finding 7) on top of P11's rules — the Batch Record pushed to transport.saveBatch after the submit and
// at the end, the batch's cost shared over replies without one, a give-up (polls run out) cancelled by ONE DELETE, the
// result's batch once a batch id exists. Record Send Batch examples 1-11, then the §2.2 rows.
import { test, expect, expectTypeOf } from "vitest";
import { BATCH_GRACE_MS, BATCH_POLL_MS, sendBatch } from "../../src/processor/batch.js";
import type { BatchRecord, GenerationResult, ProcessorConfig, Transport } from "../../src/processor/types.js";
import type { Request } from "../../src/compiler/types.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

const ID = "batch-1789576284-Ejahe4wq9AgVdp5xGdNm";
const LIVE = "batch-1791388269-cp5qOr5IQ0xoz1ntuc8W";
const URL = "https://openrouter.ai/api/beta/batches";
const config = (over: Partial<ProcessorConfig> = {}): ProcessorConfig =>
  ({ ...(fixtureJson("processor/batchConfig.json") as ProcessorConfig), ...over });
const req = (customId: string, model: string | null = null): Request =>
  ({ customId, model, maxTokens: null, reasoning: null, messages: [{ role: "user", content: "hi" }] });
type Step = Error | { status: number; text: string };
const ok = (status: number, name: string): Step => ({ status, text: fixture("processor/" + name) });
const withUsage = (name: string, usage: unknown): Step =>
  ({ status: 200, text: JSON.stringify({ ...(JSON.parse(fixture("processor/" + name)) as Record<string, unknown>), usage }) });
const zero = (customId: string) => ({ customId, inputTokens: 0, outputTokens: 0, cost: null, provider: null, generationId: null });
const err = (customId: string, error: string) => ({ customId, text: null, finishReason: null, error });
const rec = (over: Partial<BatchRecord> = {}): BatchRecord => ({ batchId: ID, processor: "glm53b", model: "z-ai/glm-5.3:batch",
  customIds: ["a.v1"], status: "validating", cost: null, ...over });

function script(steps: Step[], save?: (r: BatchRecord) => void) {
  const calls: { url: string; method: string; body: string | undefined; hasBody: boolean }[] = [];
  const sleeps: number[] = [];
  const saved: BatchRecord[] = [];
  const transport: Transport = {
    fetch: async (url, init) => {
      calls.push({ url, method: init.method, body: init.body, hasBody: "body" in init });
      const s = steps[Math.min(calls.length - 1, steps.length - 1)];
      if (s === undefined) throw new Error("no step");
      if (s instanceof Error) throw s;
      return { status: s.status, text: async () => s.text };
    },
    sleep: async (ms) => { sleeps.push(ms); },
    saveBatch: save ?? ((r) => { saved.push(r); }),
  };
  return { transport, calls, sleeps, saved };
}

test("Send Batch example 1: submitted, in progress, completed; answers in request order", async () => {
  const t = script([ok(202, "batchSubmitted.json"), ok(200, "batchInProgress.json"), ok(200, "batchCompleted.json")]);
  const got = await sendBatch(config(), [req("a.v1"), req("b.v1"), req("c.v1"), req("d.v1")], t.transport);
  expect(t.calls.map((c) => `${c.method} ${c.url} ${c.hasBody}`), "calls").toStrictEqual([
    `POST ${URL} true`, `GET ${URL}/${ID} false`, `GET ${URL}/${ID} false`]);
  expect(t.sleeps, "sleeps").toStrictEqual([15000, 15000]);
  expect(got.answers, "answers").toStrictEqual([
    { customId: "a.v1", text: "```ts\nexport const a = 1;\n```", finishReason: "stop", error: null },
    { customId: "b.v1", text: null, finishReason: "length", error: null },
    err("c.v1", "batch item error: context length exceeded"),
    err("d.v1", "batch " + ID + " completed: no result")]);
  expect(got.usage[0], "a.v1 usage").toStrictEqual({ customId: "a.v1", inputTokens: 11030, outputTokens: 571, cost: 0.00269316,
    provider: "Novita", generationId: "gen-0000000003-TESTtestTESTtestTEST" });
  expect(got.usage[3], "d.v1 usage").toStrictEqual(zero("d.v1"));
  expect(got.usage.map((u) => u.customId).join(","), "usage order").toBe("a.v1,b.v1,c.v1,d.v1");
});

test("Send Batch example 2: a 404 inside the grace goes on polling", async () => {
  const t = script([ok(202, "batchSubmitted.json"), ok(404, "batchNotFound.json"), ok(200, "batchCompleted.json")]);
  const got = await sendBatch(config(), [req("a.v1")], t.transport);
  expect(t.calls.length, "calls").toBe(3);
  expect(t.sleeps, "sleeps").toStrictEqual([15000, 15000]);
  expect(`${got.answers[0]?.finishReason} ${got.answers[0]?.error}`, "answer").toBe("stop null");
});

test("Send Batch example 3: a 404 past the grace is final", async () => {
  const p = ok(200, "batchInProgress.json");
  const t = script([ok(202, "batchSubmitted.json"), p, p, p, p, ok(404, "batchNotFound.json"), ok(200, "batchCompleted.json")]);
  const got = await sendBatch(config({ timeoutMs: 120000 }), [req("a.v1")], t.transport);
  expect(t.calls.length, "calls").toBe(6);
  expect(t.sleeps, "sleeps").toStrictEqual([15000, 15000, 15000, 15000, 15000]);
  expect(got.answers, "answer").toStrictEqual([err("a.v1", "batch " + ID + ": http 404: Batch job " + ID + " not found.")]);
});

test("Send Batch example 4: a failed batch answers every request with its error", async () => {
  const t = script([ok(202, "batchSubmitted.json"), ok(200, "batchFailed.json")]);
  const got = await sendBatch(config(), [req("a.v1"), req("b.v1")], t.transport);
  const e = "batch " + ID + " failed: HTTP 400: invalid batch inference job: job-submission-count for account acct-0000, in use: 16, quota: 16";
  expect(t.calls.length, "calls").toBe(2);
  expect(got, "result").toStrictEqual({ answers: [err("a.v1", e), err("b.v1", e)], usage: [zero("a.v1"), zero("b.v1")],
    batch: rec({ customIds: ["a.v1", "b.v1"], status: "failed" }) });
});

test("Send Batch example 5: a refused submit is final at once", async () => {
  const t = script([ok(400, "noBatchEndpoint.json")]);
  const got = await sendBatch(config(), [req("a.v1"), req("b.v1")], t.transport);
  const e = "batch submit: http 400: HTTP 400: invalid batch inference job: Model 'z-ai/glm-5.3:batch' does not have a :batch endpoint.";
  expect(`${t.calls.length} ${t.sleeps.length}`, "one call, no sleep").toBe("1 0");
  expect(got.answers, "answers").toStrictEqual([err("a.v1", e), err("b.v1", e)]);
});

test("Send Batch example 6: the polls run out; the batch is cancelled by ONE DELETE", async () => {
  const t = script([ok(202, "batchSubmitted.json"), ok(200, "batchInProgress.json")]);
  const got = await sendBatch(config(), [req("a.v1")], t.transport);
  expect(t.calls.map((c) => `${c.method} ${c.url} ${c.hasBody}`), "calls").toStrictEqual([`POST ${URL} true`,
    `GET ${URL}/${ID} false`, `GET ${URL}/${ID} false`, `GET ${URL}/${ID} false`, `GET ${URL}/${ID} false`, `DELETE ${URL}/${ID} false`]);
  expect(t.sleeps, "sleeps").toStrictEqual([15000, 15000, 15000, 15000]);
  expect(got, "result").toStrictEqual({ answers: [err("a.v1", "batch " + ID + " still in_progress after 4 polls")], usage: [zero("a.v1")],
    batch: rec({ status: "deleted" }) });
});

test("Send Batch example 7: a pinned model is left out; a thrown poll goes on", async () => {
  const t = script([ok(202, "batchSubmitted.json"), new Error("socket hang up"), ok(200, "batchCompleted.json")]);
  const got = await sendBatch(config(), [req("x.v1", "other/m"), req("a.v1")], t.transport);
  expect(t.calls.length, "calls").toBe(3);
  const posted = JSON.parse(t.calls[0]?.body ?? "null") as { requests: { custom_id: string }[] };
  expect(posted.requests.map((r) => r.custom_id).join(","), "posted").toBe("a.v1");
  expect(got.answers[0], "x.v1").toStrictEqual(err("x.v1", "batch runs one model: x.v1 pins other/m, the batch is z-ai/glm-5.3:batch"));
  expect(`${got.answers[1]?.customId} ${got.answers[1]?.finishReason} ${got.answers[1]?.error}`, "a.v1").toBe("a.v1 stop null");
});

test("Send Batch example 8: a second batch model; the pinned text names config.model on the completed path", async () => {
  const t = script([ok(202, "batchSubmitted.json"), ok(200, "batchCompleted.json")]);
  const got = await sendBatch(config({ model: "acme/m:batch" }), [req("x.v1", "z-ai/glm-5.3:batch"), req("a.v1")], t.transport);
  expect(t.calls.length, "calls").toBe(2);
  const posted = JSON.parse(t.calls[0]?.body ?? "null") as { model: string; requests: { custom_id: string }[] };
  expect(`${posted.model} ${posted.requests.map((r) => r.custom_id).join(",")}`, "posted").toBe("acme/m:batch a.v1");
  expect(got.answers[0]?.error, "x.v1 (expected the batch model acme/m:batch)")
    .toBe("batch runs one model: x.v1 pins z-ai/glm-5.3:batch, the batch is acme/m:batch");
  expect(`${got.answers[1]?.customId} ${got.answers[1]?.finishReason} ${got.answers[1]?.error}`, "a.v1").toBe("a.v1 stop null");
});

test("Send Batch rows: a pinned request names config.model on every path (batch model acme/m:batch)", async () => {
  const pin = "batch runs one model: x.v1 pins o/m, the batch is acme/m:batch";
  const acme = config({ model: "acme/m:batch" });
  const paths: [string, Step[], ProcessorConfig][] = [
    ["only pinned", [ok(202, "batchSubmitted.json")], acme],
    ["submit thrown", [new Error("down")], acme],
    ["submit refused", [{ status: 503, text: "upstream down" }], acme],
    ["no batch id", [{ status: 202, text: JSON.stringify({ status: "validating" }) }], acme],
    ["final poll error", [ok(202, "batchSubmitted.json"), { status: 401, text: "no" }], acme],
    ["failed batch", [ok(202, "batchSubmitted.json"), ok(200, "batchFailed.json")], acme],
    ["polls run out", [ok(202, "batchSubmitted.json"), ok(200, "batchInProgress.json")], { ...acme, timeoutMs: 15000 }],
  ];
  for (const [name, steps, cfg] of paths) {
    const t = script(steps);
    const reqs = name === "only pinned" ? [req("x.v1", "o/m")] : [req("x.v1", "o/m"), req("a.v1")];
    const got = await sendBatch(cfg, reqs, t.transport);
    expect(got.answers[0]?.error, name + " (expected the batch model acme/m:batch)").toBe(pin);
  }
});

test("Send Batch rows: no call for no request or only pinned ones; the model equal to the config's is kept", async () => {
  const t = script([ok(202, "batchSubmitted.json")]);
  expect(await sendBatch(config(), [], t.transport), "empty").toStrictEqual({ answers: [], usage: [] });
  const got = await sendBatch(config(), [req("x.v1", "o/m")], t.transport);
  expect(`${t.calls.length} ${t.sleeps.length} ${got.answers[0]?.error}`, "pinned only")
    .toBe("0 0 batch runs one model: x.v1 pins o/m, the batch is z-ai/glm-5.3:batch");
  const u = script([ok(202, "batchSubmitted.json"), ok(200, "batchCompleted.json")]);
  const same = await sendBatch(config(), [req("a.v1", "z-ai/glm-5.3:batch")], u.transport);
  expect(same.answers[0]?.finishReason, "same model").toBe("stop");
});

test("Send Batch rows: submit failures are never retried", async () => {
  const thrown = script([new Error("socket hang up")]);
  const a = await sendBatch(config(), [req("a.v1")], thrown.transport);
  expect(`${thrown.calls.length} ${thrown.sleeps.length} ${a.answers[0]?.error}`, "thrown").toBe("1 0 batch submit: transport: socket hang up");
  const s503 = script([{ status: 503, text: "upstream down" }]);
  const b = await sendBatch(config(), [req("a.v1")], s503.transport);
  expect(`${s503.calls.length} ${b.answers[0]?.error}`, "503").toBe("1 batch submit: http 503: upstream down");
  const noId = script([{ status: 202, text: JSON.stringify({ status: "validating" }) }]);
  const c = await sendBatch(config(), [req("a.v1")], noId.transport);
  expect(`${noId.calls.length} ${c.answers[0]?.error}`, "no id").toBe("1 batch submit: no batch id");
});

test("Send Batch rows: 429 and 5xx polls are transient, another 4xx is final; polls >= 1", async () => {
  const t = script([ok(202, "batchSubmitted.json"), { status: 429, text: "slow" }, { status: 500, text: "bad" }, ok(200, "batchCompleted.json")]);
  const got = await sendBatch(config(), [req("a.v1")], t.transport);
  expect(`${t.calls.length} ${got.answers[0]?.error}`, "transient").toBe("4 null");
  const f = script([ok(202, "batchSubmitted.json"), { status: 401, text: JSON.stringify({ error: { message: "No auth" } }) }]);
  const g = await sendBatch(config(), [req("a.v1")], f.transport);
  expect(`${f.calls.length} ${g.answers[0]?.error}`, "401").toBe("2 batch " + ID + ": http 401: No auth");
  const one = script([ok(202, "batchSubmitted.json"), ok(200, "batchInProgress.json")]);
  const h = await sendBatch(config({ timeoutMs: 1000 }), [req("a.v1")], one.transport);
  expect(`${one.calls.length} ${h.answers[0]?.error}`, "one poll, then the DELETE").toBe("3 batch " + ID + " still in_progress after 1 polls");
  const r408 = script([ok(202, "batchSubmitted.json"), { status: 408, text: "timeout" }, ok(200, "batchCompleted.json")]);
  const m = await sendBatch(config(), [req("a.v1")], r408.transport);
  expect(`${r408.calls.length} ${m.answers[0]?.error}`, "408 transient").toBe("3 null");
  const p = ok(200, "batchInProgress.json");
  const edge = script([ok(202, "batchSubmitted.json"), p, p, p, ok(404, "batchNotFound.json"), ok(200, "batchCompleted.json")]);
  const n = await sendBatch(config({ timeoutMs: 90000 }), [req("a.v1")], edge.transport);
  expect(`${edge.calls.length} ${n.answers[0]?.error}`, "a 404 at poll 4 (60000 ms) is still inside the grace").toBe("6 null");
  const three = script([ok(202, "batchSubmitted.json"), p]);
  const q = await sendBatch(config({ timeoutMs: 50000 }), [req("a.v1")], three.transport);
  expect(q.answers[0]?.error, "floor(50000 / 15000) = 3").toBe("batch " + ID + " still in_progress after 3 polls");
  const dup = JSON.stringify({ id: ID, status: "completed", error: null, results: [
    { custom_id: "a.v1", response: null, error: { message: "first" } }, { custom_id: "a.v1", response: null, error: { message: "second" } }] });
  const twice = script([ok(202, "batchSubmitted.json"), { status: 200, text: dup }]);
  const d = await sendBatch(config(), [req("a.v1")], twice.transport);
  expect(d.answers[0]?.error, "the first reply of a customId").toBe("batch item error: first");
  const sub = script([ok(202, "batchSubmitted.json"), new Error("down")]);
  const k = await sendBatch(config({ timeoutMs: 30000 }), [req("a.v1")], sub.transport);
  expect(k.answers[0]?.error, "the submit's status when no poll read").toBe("batch " + ID + " still validating after 2 polls");
});

test("Send Batch example 9: the live batch; the batch's cost shared over the replies; the record pushed twice", async () => {
  const t = script([ok(202, "batchSubmittedLive.json"), ok(200, "batchCompletedLive.json")]);
  const got = await sendBatch(config(), [req("clamp-value.v1"), req("sign-of.v1")], t.transport);
  const want = fixtureJson("processor/sendBatch.json") as Record<string, Record<string, unknown>>;
  expect(`${t.calls.length} ${JSON.stringify(t.sleeps)}`, "calls, sleeps").toBe("2 [15000]");
  expect(got.usage.map((u) => u.cost), "the shares of 0.0005804").toStrictEqual([0.0003029253, 0.0002774747]);
  expect(got, "answers, usage, batch exactly sendBatch.json[\"9\"]").toStrictEqual({ answers: want["9"]?.answers, usage: want["9"]?.usage,
    batch: want["9"]?.batch });
  expect(t.saved, "pushed records").toStrictEqual(want["9"]?.saved);
});

test("Send Batch example 10: a second processor and model; the give-up cancels, the record says deleted", async () => {
  const p = ok(200, "batchInProgress.json");
  const t = script([ok(202, "batchSubmittedLive.json"), p, p, ok(200, "batchDeleted.json")]);
  const got = await sendBatch(config({ id: "night", model: "acme/m:batch", timeoutMs: 30000 }),
    [req("x.v1", "other/m"), req("clamp-value.v1")], t.transport);
  expect(t.calls.map((c) => c.method).join(" "), "methods").toBe("POST GET GET DELETE");
  expect(t.calls[3]?.url, "the DELETE").toBe(URL + "/" + LIVE);
  expect(got.answers, "answers").toStrictEqual([err("x.v1", "batch runs one model: x.v1 pins other/m, the batch is acme/m:batch"),
    err("clamp-value.v1", "batch " + LIVE + " still in_progress after 2 polls")]);
  const batch = { batchId: LIVE, processor: "night", model: "acme/m:batch", customIds: ["clamp-value.v1"], status: "deleted", cost: null };
  expect(got.batch, "batch").toStrictEqual(batch);
  expect(t.saved, "pushed").toStrictEqual([{ ...batch, status: "validating" }, batch]);
});

test("Send Batch example 11: a reply's own cost is kept; a throwing saveBatch is ignored", async () => {
  const t = script([ok(202, "batchSubmitted.json"), withUsage("batchCompleted.json", { cost: 0.5 })],
    () => { throw new Error("disk full"); });
  const got = await sendBatch(config(), [req("a.v1")], t.transport);
  expect(`${got.answers[0]?.finishReason} ${got.answers[0]?.error} ${got.usage[0]?.cost}`, "a.v1").toBe("stop null 0.00269316");
  expect(`${got.batch?.status} ${got.batch?.cost}`, "batch").toBe("completed 0.5");
});

test("Send Batch rows: no batch key before a batch id; batch on a final error; the share rule", async () => {
  for (const steps of [[new Error("down")], [ok(400, "noBatchEndpoint.json")], [{ status: 202, text: JSON.stringify({ status: "validating" }) }]] as Step[][]) {
    const t = script(steps);
    const got = await sendBatch(config(), [req("a.v1")], t.transport);
    expect(`${"batch" in got} ${t.saved.length}`, "no batch, nothing pushed: " + JSON.stringify(got.answers[0]?.error)).toBe("false 0");
  }
  const pinned = script([ok(202, "batchSubmitted.json")]);
  expect("batch" in await sendBatch(config(), [req("x.v1", "o/m")], pinned.transport), "only pinned").toBe(false);
  const f = script([ok(202, "batchSubmitted.json"), { status: 401, text: "no" }]);
  const g = await sendBatch(config(), [req("x.v1", "o/m"), req("a.v1")], f.transport);
  expect(g.batch, "a final error read: the record as it stands, no DELETE").toStrictEqual(rec());
  expect(`${f.calls.length} ${f.saved.length}`, "calls, pushed").toBe("2 1");
  const c1 = script([ok(202, "batchSubmittedLive.json"), withUsage("batchCompletedLive.json", { cost: 0.001 })]);
  const h = await sendBatch(config(), [req("clamp-value.v1"), req("sign-of.v1")], c1.transport);
  expect(h.usage.map((u) => u.cost), "shares of 0.001").toStrictEqual([0.0005219251, 0.0004780749]);
  const c0 = script([ok(202, "batchSubmittedLive.json"), withUsage("batchCompletedLive.json", { cost: 0 })]);
  const k = await sendBatch(config(), [req("clamp-value.v1"), req("sign-of.v1")], c0.transport);
  expect(k.usage.map((u) => u.cost), "shares of 0").toStrictEqual([0, 0]);
  const errs = JSON.stringify({ id: ID, status: "completed", usage: { cost: 0.2 }, results: [
    { custom_id: "a.v1", response: null, error: { message: "boom" } }] });
  const e0 = script([ok(202, "batchSubmitted.json"), { status: 200, text: errs }]);
  const m = await sendBatch(config(), [req("a.v1")], e0.transport);
  expect(`${m.usage[0]?.cost} ${m.batch?.cost}`, "no tokens: costs stay null").toBe("null 0.2");
  const del = script([ok(202, "batchSubmitted.json"), ok(200, "batchInProgress.json"), { status: 404, text: "404 Not Found" }]);
  const n = await sendBatch(config({ timeoutMs: 15000 }), [req("a.v1")], del.transport);
  expect(`${del.calls.map((c) => c.method).join(" ")} ${n.batch?.status} ${n.answers[0]?.error}`, "a refused DELETE")
    .toBe("POST GET DELETE in_progress batch " + ID + " still in_progress after 1 polls");
  const thrown = script([ok(202, "batchSubmitted.json"), new Error("down")]);
  const q = await sendBatch(config({ timeoutMs: 15000 }), [req("a.v1")], thrown.transport);
  expect(`${thrown.calls.length} ${q.batch?.status} ${thrown.saved.map((r) => r.status).join(",")}`, "a thrown DELETE")
    .toBe("3 validating validating,validating");
});

test("Send Batch rows: the constants and the signature", () => {
  expect(`${BATCH_POLL_MS} ${BATCH_GRACE_MS}`, "constants").toBe("15000 60000");
  expectTypeOf(sendBatch).toEqualTypeOf<(config: ProcessorConfig, requests: Request[], transport: Transport) => Promise<GenerationResult>>();
  expectTypeOf<Parameters<Transport["fetch"]>[1]>().toEqualTypeOf<{ method: string; headers: Record<string, string>; body?: string }>();
  expectTypeOf<Transport["saveBatch"]>().toEqualTypeOf<((record: BatchRecord) => void) | undefined>();
  expectTypeOf<GenerationResult["batch"]>().toEqualTypeOf<BatchRecord | undefined>();
  expectTypeOf<BatchRecord>().toEqualTypeOf<{ batchId: string; processor: string; model: string; customIds: string[]; status: string;
    cost: number | null }>();
});
