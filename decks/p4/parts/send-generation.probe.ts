// P4 probe for send-generation: sendGeneration by docs/TASK_P4_processor.md §2.2, one test per
// record example (Component processor, Function Send Generation), then the boundary rows of
// §2.2. The transport is fakeFetch of tests/helpers.ts plus a sleep that records its argument
// and resolves at once: no real timer, no network.
import { test, expect } from "vitest";
import { BACKOFF_MS, realTransport, sendGeneration } from "../../src/processor/send.js";
import type { GenerationResult, HttpReply, ProcessorConfig, Transport } from "../../src/processor/types.js";
import type { Request } from "../../src/compiler/types.js";
import { fakeFetch, fixture, fixtureJson, flush, tmpRoot } from "../../tests/helpers.js";

const URL_ = "https://openrouter.ai/api/v1/chat/completions";
const glm = (over: Partial<ProcessorConfig> = {}): ProcessorConfig =>
  ({ ...(fixtureJson("processor/glmConfig.json") as ProcessorConfig), ...over });
const rq = (customId: string): Request =>
  ({ customId, model: null, maxTokens: null, reasoning: null, messages: [{ role: "user", content: "hi" }] });
const OK = { status: 200, text: fixture("processor/okResponse.json") };
const ERR402 = { status: 402, text: fixture("processor/errorResponse.json") };

function rig(fetch: Transport["fetch"]): { t: Transport; sleeps: number[] } {
  const sleeps: number[] = [];
  return { t: { fetch, sleep: async (ms: number): Promise<void> => { sleeps.push(ms); } }, sleeps };
}
const errs = (g: GenerationResult): string => g.answers.map((a) => `${a.customId}:${a.error}`).join(" | ");

test("Send Generation example 1: two requests, both answered, usage per customId", async () => {
  const ff = fakeFetch({ [URL_]: OK });
  const { t, sleeps } = rig(ff.fetch);
  const got: GenerationResult = await sendGeneration(glm(), [rq("a.v1"), rq("a.v2")], t);
  expect(ff.calls.length, "two calls").toBe(2);
  for (const c of ff.calls) {
    expect(`${c.method} ${c.url}`, "POST to the chat completions url").toBe(`POST ${URL_}`);
    expect(c.headers["Authorization"], "the bearer key").toBe("Bearer sk-or-test");
    const body = JSON.parse(c.body ?? "null") as { usage?: unknown };
    expect(JSON.stringify(body.usage), "usage asked for").toBe('{"include":true}');
  }
  expect(got.answers.map((a) => `${a.customId} ${a.finishReason} ${a.error}`).join(" | "), "answers in order").toBe(
    "a.v1 stop null | a.v2 stop null");
  expect(got.answers[0]?.text, "the text").toBe("```ts\nexport const a = 1;\n```");
  expect(got.usage.map((u) => `${u.customId} ${u.inputTokens} ${u.outputTokens}`).join(" | "), "usage in order").toBe(
    "a.v1 11030 571 | a.v2 11030 571");
  expect(sleeps.length, "no sleep").toBe(0);
});

test("Send Generation example 2: a transport error is retried with backoff, then reported", async () => {
  const ff = fakeFetch({ [URL_]: OK });
  ff.failAll(new Error("socket hang up"));
  const { t, sleeps } = rig(ff.fetch);
  const got = await sendGeneration(glm(), [rq("a.v1")], t);
  expect(ff.calls.length, "1 + maxRetries calls").toBe(3);
  expect(JSON.stringify(sleeps), "sleeps").toBe("[1000,2000]");
  expect(got.answers[0], "answer").toStrictEqual({ customId: "a.v1", text: null, finishReason: null,
    error: "transport: socket hang up (after 3 attempts)" });
  expect(got.usage[0], "usage").toStrictEqual({ customId: "a.v1", inputTokens: 0, outputTokens: 0, cost: null, provider: null, generationId: null });
});

test("Send Generation example 3: a refusal is final at once", async () => {
  const ff = fakeFetch({ [URL_]: ERR402 });
  const { t, sleeps } = rig(ff.fetch);
  const got = await sendGeneration(glm(), [rq("a.v1")], t);
  expect(`${ff.calls.length} ${sleeps.length}`, "one call, no sleep").toBe("1 0");
  expect(errs(got), "error").toBe("a.v1:http 402: Insufficient credits. Add more using https://openrouter.ai/settings/credits");
});

test("Send Generation example 4: a 503 is retried once and the 200 wins", async () => {
  const ff = fakeFetch({ [URL_]: OK });
  let n = 0;
  const { t, sleeps } = rig(async (url, init): Promise<HttpReply> => {
    n += 1;
    if (n === 1) return { status: 503, text: async (): Promise<string> => "upstream down" };
    return ff.fetch(url, init);
  });
  const got = await sendGeneration(glm(), [rq("a.v1")], t);
  expect(n, "two calls").toBe(2);
  expect(JSON.stringify(sleeps), "sleeps").toBe("[1000]");
  expect(`${got.answers[0]?.finishReason} ${got.answers[0]?.error} ${got.usage[0]?.inputTokens}`, "answer and usage").toBe("stop null 11030");
});

test("Send Generation example 5: at most concurrency requests in flight, answers in request order", async () => {
  const ff = fakeFetch({ [URL_]: OK });
  let live = 0;
  let peak = 0;
  const { t } = rig(async (url, init): Promise<HttpReply> => {
    live += 1;
    peak = Math.max(peak, live);
    await flush();
    live -= 1;
    return ff.fetch(url, init);
  });
  const got = await sendGeneration(glm({ concurrency: 2 }), [rq("r1.v1"), rq("r2.v1"), rq("r3.v1")], t);
  expect(`${peak} ${ff.calls.length}`, "peak in flight, calls").toBe("2 3");
  expect(got.answers.map((a) => a.customId).join(","), "order").toBe("r1.v1,r2.v1,r3.v1");
});

test("§2.2 rows: retry statuses, no retries, stub and batch routes, empty generation", async () => {
  for (const s of [408, 429, 500, 599]) {
    const ff = fakeFetch({ [URL_]: { status: s, text: "busy" } });
    const { t, sleeps } = rig(ff.fetch);
    const got = await sendGeneration(glm({ maxRetries: 1 }), [rq("a.v1")], t);
    expect(`${ff.calls.length} ${JSON.stringify(sleeps)} ${got.answers[0]?.error}`, `status ${s} is retried`).toBe(
      `2 [1000] http ${s}: busy (after 2 attempts)`);
  }
  for (const s of [400, 401, 404]) {
    const ff = fakeFetch({ [URL_]: { status: s, text: "no" } });
    const { t } = rig(ff.fetch);
    const got = await sendGeneration(glm(), [rq("a.v1")], t);
    expect(`${ff.calls.length} ${got.answers[0]?.error}`, `status ${s} is final`).toBe(`1 http ${s}: no`);
  }
  {
    const ff = fakeFetch();
    ff.failAll(new Error("reset"));
    const { t, sleeps } = rig(ff.fetch);
    const got = await sendGeneration(glm({ maxRetries: 0 }), [rq("a.v1")], t);
    expect(`${ff.calls.length} ${sleeps.length} ${got.answers[0]?.error}`, "maxRetries 0: no suffix").toBe("1 0 transport: reset");
  }
  {
    const ff = fakeFetch({ [URL_]: OK });
    const { t, sleeps } = rig(ff.fetch);
    const got = await sendGeneration(glm({ maxRetries: 3 }), [rq("a.v1")], t);
    expect(`${ff.calls.length} ${sleeps.length}`, "a first success sleeps never").toBe("1 0");
    expect(got.answers[0]?.error === null, "error is null").toBe(true);
  }
  {
    const ff = fakeFetch();
    ff.failAll(new Error("down"));
    const { t, sleeps } = rig(ff.fetch);
    await sendGeneration(glm({ maxRetries: 3 }), [rq("a.v1")], t);
    expect(JSON.stringify(sleeps), "1000 * 2^k").toBe("[1000,2000,4000]");
    expect(BACKOFF_MS, "BACKOFF_MS").toBe(1000);
  }
  {
    const r = tmpRoot();
    try {
      r.write("s.md", "S\n");
      const ff = fakeFetch({ [URL_]: OK });
      const { t } = rig(ff.fetch);
      const stub = glm({ type: "stub", model: "stub", apiKey: null, answersDir: r.root, providerOrder: null, reasoning: null });
      const got = await sendGeneration(stub, [rq("s.v1"), rq("s.v2")], t);
      expect(`${ff.calls.length} ${got.answers.map((a) => a.text).join("")}`, "stub: no call, its files").toBe("0 S\nS\n");
      expect(got.usage.map((u) => u.provider).join(","), "stub usage").toBe("stub,stub");
    } finally {
      r.rm();
    }
  }
  {
    const ff = fakeFetch({ [URL_]: OK });
    const { t } = rig(ff.fetch);
    const got = await sendGeneration(glm({ route: "batch" }), [rq("a.v1"), rq("b.v1")], t);
    expect(`${ff.calls.length} ${errs(got)}`, "batch route: no call").toBe(
      "0 a.v1:route batch is not available on the sync sender | b.v1:route batch is not available on the sync sender");
    expect(got.usage.map((u) => `${u.inputTokens} ${u.cost}`).join(","), "batch usage").toBe("0 null,0 null");
  }
  {
    const ff = fakeFetch({ [URL_]: OK });
    const { t } = rig(ff.fetch);
    const got = await sendGeneration(glm(), [], t);
    expect(`${ff.calls.length} ${got.answers.length} ${got.usage.length}`, "empty generation").toBe("0 0 0");
  }
  const real = realTransport(1000);
  expect(`${typeof real.fetch} ${typeof real.sleep}`, "realTransport shape (never called here)").toBe("function function");
});
