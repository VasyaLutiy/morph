// P11 probe for send-batch: one generation as one OpenRouter batch by docs/TASK_P11_processor.md §2.2 — the submit
// once and never retried, the polls (sleep first, GET with no body, BATCH_POLL_MS 15000, polls = floor(timeoutMs /
// 15000)), the transient polls and the 404 grace, final reads, the results mapped back by customId, the deadline, a
// pinned model. Record Send Batch examples 1-7, then the §2.2 rows.
import { test, expect, expectTypeOf } from "vitest";
import { BATCH_GRACE_MS, BATCH_POLL_MS, sendBatch } from "../../src/processor/batch.js";
import type { GenerationResult, ProcessorConfig, Transport } from "../../src/processor/types.js";
import type { Request } from "../../src/compiler/types.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

const ID = "batch-1789576284-Ejahe4wq9AgVdp5xGdNm";
const URL = "https://openrouter.ai/api/beta/batches";
const config = (over: Partial<ProcessorConfig> = {}): ProcessorConfig =>
  ({ ...(fixtureJson("processor/batchConfig.json") as ProcessorConfig), ...over });
const req = (customId: string, model: string | null = null): Request =>
  ({ customId, model, maxTokens: null, reasoning: null, messages: [{ role: "user", content: "hi" }] });
type Step = Error | { status: number; text: string };
const ok = (status: number, name: string): Step => ({ status, text: fixture("processor/" + name) });
const zero = (customId: string) => ({ customId, inputTokens: 0, outputTokens: 0, cost: null, provider: null, generationId: null });
const err = (customId: string, error: string) => ({ customId, text: null, finishReason: null, error });

function script(steps: Step[]) {
  const calls: { url: string; method: string; body: string | undefined; hasBody: boolean }[] = [];
  const sleeps: number[] = [];
  const transport: Transport = {
    fetch: async (url, init) => {
      calls.push({ url, method: init.method, body: init.body, hasBody: "body" in init });
      const s = steps[Math.min(calls.length - 1, steps.length - 1)];
      if (s === undefined) throw new Error("no step");
      if (s instanceof Error) throw s;
      return { status: s.status, text: async () => s.text };
    },
    sleep: async (ms) => { sleeps.push(ms); },
  };
  return { transport, calls, sleeps };
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
  expect(got, "result").toStrictEqual({ answers: [err("a.v1", e), err("b.v1", e)], usage: [zero("a.v1"), zero("b.v1")] });
});

test("Send Batch example 5: a refused submit is final at once", async () => {
  const t = script([ok(400, "noBatchEndpoint.json")]);
  const got = await sendBatch(config(), [req("a.v1"), req("b.v1")], t.transport);
  const e = "batch submit: http 400: HTTP 400: invalid batch inference job: Model 'z-ai/glm-5.3:batch' does not have a :batch endpoint.";
  expect(`${t.calls.length} ${t.sleeps.length}`, "one call, no sleep").toBe("1 0");
  expect(got.answers, "answers").toStrictEqual([err("a.v1", e), err("b.v1", e)]);
});

test("Send Batch example 6: the polls run out", async () => {
  const t = script([ok(202, "batchSubmitted.json"), ok(200, "batchInProgress.json")]);
  const got = await sendBatch(config(), [req("a.v1")], t.transport);
  expect(t.calls.length, "calls").toBe(5);
  expect(t.sleeps, "sleeps").toStrictEqual([15000, 15000, 15000, 15000]);
  expect(got, "result").toStrictEqual({ answers: [err("a.v1", "batch " + ID + " still in_progress after 4 polls")], usage: [zero("a.v1")] });
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
  expect(`${one.calls.length} ${h.answers[0]?.error}`, "one poll").toBe("2 batch " + ID + " still in_progress after 1 polls");
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

test("Send Batch rows: the constants and the signature", () => {
  expect(`${BATCH_POLL_MS} ${BATCH_GRACE_MS}`, "constants").toBe("15000 60000");
  expectTypeOf(sendBatch).toEqualTypeOf<(config: ProcessorConfig, requests: Request[], transport: Transport) => Promise<GenerationResult>>();
  expectTypeOf<Parameters<Transport["fetch"]>[1]>().toEqualTypeOf<{ method: string; headers: Record<string, string>; body?: string }>();
});
