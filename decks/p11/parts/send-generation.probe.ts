// P11 probe for send-generation: the route switch by docs/TASK_P11_processor.md §2.2 — type stub answers from files on
// either route, type openrouter on route batch goes through Send Batch, route sync keeps the P4 pool. Record Send
// Generation examples 6-7, then the rows that must not change.
import { test, expect } from "vitest";
import { sendGeneration } from "../../src/processor/send.js";
import type { ProcessorConfig, Transport } from "../../src/processor/types.js";
import type { Request } from "../../src/compiler/types.js";
import { fakeFetch, fixture, fixtureJson, tmpRoot } from "../../tests/helpers.js";

const ID = "batch-1789576284-Ejahe4wq9AgVdp5xGdNm";
const req = (customId: string): Request =>
  ({ customId, model: null, maxTokens: null, reasoning: null, messages: [{ role: "user", content: "hi" }] });

test("Send Generation example 6: route batch goes through Send Batch", async () => {
  const config = fixtureJson("processor/batchConfig.json") as ProcessorConfig;
  const calls: string[] = [];
  const sleeps: number[] = [];
  const transport: Transport = {
    fetch: async (url, init) => {
      calls.push(init.method + " " + url);
      return calls.length === 1
        ? { status: 202, text: async () => fixture("processor/batchSubmitted.json") }
        : { status: 200, text: async () => fixture("processor/batchCompleted.json") };
    },
    sleep: async (ms) => { sleeps.push(ms); },
  };
  const got = await sendGeneration(config, [req("a.v1")], transport);
  expect(calls, "calls").toStrictEqual(["POST https://openrouter.ai/api/beta/batches", "GET https://openrouter.ai/api/beta/batches/" + ID]);
  expect(sleeps, "sleeps").toStrictEqual([15000]);
  expect(got.answers, "answers").toStrictEqual([{ customId: "a.v1", text: "```ts\nexport const a = 1;\n```", finishReason: "stop", error: null }]);
  expect(`${got.usage[0]?.inputTokens} ${got.usage[0]?.outputTokens} ${got.usage[0]?.cost}`, "usage").toBe("11030 571 0.00269316");
});

test("Send Generation example 7: a stub on route batch answers from files", async () => {
  const t = tmpRoot();
  try {
    t.write("answers/a.v1.md", "A\n");
    const config: ProcessorConfig = { id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1",
      route: "batch", concurrency: 1, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 2, answersDir: t.path("answers") };
    const ff = fakeFetch();
    const sleeps: number[] = [];
    const got = await sendGeneration(config, [req("a.v1")], { fetch: ff.fetch, sleep: async (ms) => { sleeps.push(ms); } });
    expect(`${ff.calls.length} ${sleeps.length}`, "no call, no sleep").toBe("0 0");
    expect(got.answers, "answers").toStrictEqual([{ customId: "a.v1", text: "A\n", finishReason: "stop", error: null }]);
  } finally {
    t.rm();
  }
});

test("Send Generation rows: the sync route is unchanged", async () => {
  const config = fixtureJson("processor/glmConfig.json") as ProcessorConfig;
  const url = "https://openrouter.ai/api/v1/chat/completions";
  const ff = fakeFetch({ [url]: { status: 200, text: fixture("processor/okResponse.json") } });
  const got = await sendGeneration(config, [req("a.v1"), req("a.v2")], { fetch: ff.fetch, sleep: async () => {} });
  expect(ff.calls.map((c) => c.method + " " + c.url), "calls").toStrictEqual(["POST " + url, "POST " + url]);
  expect(got.answers.map((a) => a.finishReason).join(","), "answers").toBe("stop,stop");
  const sync = { ...config, route: "sync" as const, type: "openrouter" as const };
  const e = fakeFetch();
  const r = await sendGeneration({ ...sync, maxRetries: 0 }, [req("a.v1")], { fetch: e.fetch, sleep: async () => {} });
  expect(r.answers[0]?.error, "a 404 on sync").toBe('http 404: {"error":"not found"}');
});

test("Send Generation rows: no route error text is left", async () => {
  const config = { ...(fixtureJson("processor/batchConfig.json") as ProcessorConfig), timeoutMs: 15000 };
  const ff = fakeFetch();
  const got = await sendGeneration(config, [req("a.v1")], { fetch: ff.fetch, sleep: async () => {} });
  expect(got.answers[0]?.error, "the batch route reached the provider").toBe('batch submit: http 404: {"error":"not found"}');
  expect(ff.calls.length, "one submit").toBe(1);
});
