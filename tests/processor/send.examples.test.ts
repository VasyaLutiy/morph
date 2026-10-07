import { expect, test } from "vitest";
import { BACKOFF_MS, sendGeneration } from "../../src/processor/send.js";
import type { ProcessorConfig, Transport } from "../../src/processor/types.js";
import type { Request } from "../../src/compiler/types.js";
import { fakeFetch, fixture, fixtureJson, flush, tmpRoot } from "../helpers.js";

const URL = "https://openrouter.ai/api/v1/chat/completions";

function req(customId: string): Request {
  return {
    customId,
    model: null,
    maxTokens: null,
    reasoning: null,
    messages: [{ role: "user", content: "hi" }]
  };
}

test("Send Generation example 1: two 200 answers with usage and no sleep", async () => {
  const config = fixtureJson("processor/glmConfig.json") as ProcessorConfig;
  const ff = fakeFetch({ [URL]: { status: 200, text: fixture("processor/okResponse.json") } });
  const sleeps: number[] = [];
  const transport: Transport = {
    fetch: ff.fetch,
    sleep: async (ms: number) => { sleeps.push(ms); }
  };
  const result = await sendGeneration(config, [req("a.v1"), req("a.v2")], transport);
  expect(ff.calls.length).toBe(2);
  for (const call of ff.calls) {
    expect(call.method).toBe("POST");
    expect(call.headers.Authorization).toBe("Bearer sk-or-test");
    const body = JSON.parse(call.body ?? "null") as { usage: { include: boolean } };
    expect(body.usage).toStrictEqual({ include: true });
  }
  expect(result.answers.map((a) => a.customId)).toStrictEqual(["a.v1", "a.v2"]);
  for (const a of result.answers) {
    expect(a.finishReason).toBe("stop");
    expect(a.error).toBeNull();
  }
  for (const u of result.usage) {
    expect(u.inputTokens).toBe(11030);
    expect(u.outputTokens).toBe(571);
  }
  expect(sleeps).toStrictEqual([]);
});

test("Send Generation example 2: hung socket retried with backoff", async () => {
  const config = fixtureJson("processor/glmConfig.json") as ProcessorConfig;
  const ff = fakeFetch({ [URL]: { status: 200, text: "" } });
  ff.failAll(new Error("socket hang up"));
  const sleeps: number[] = [];
  const transport: Transport = {
    fetch: ff.fetch,
    sleep: async (ms: number) => { sleeps.push(ms); }
  };
  const result = await sendGeneration(config, [req("a.v1")], transport);
  expect(ff.calls.length).toBe(3);
  expect(sleeps).toStrictEqual([1000, 2000]);
  expect(result.answers[0]?.text).toBeNull();
  expect(result.answers[0]?.error).toBe("transport: socket hang up (after 3 attempts)");
  expect(result.usage[0]?.inputTokens).toBe(0);
  expect(result.usage[0]?.outputTokens).toBe(0);
  expect(result.usage[0]?.cost).toBeNull();
});

test("Send Generation example 3: 402 refusal is final at once", async () => {
  const config = fixtureJson("processor/glmConfig.json") as ProcessorConfig;
  const ff = fakeFetch({ [URL]: { status: 402, text: fixture("processor/errorResponse.json") } });
  const sleeps: number[] = [];
  const transport: Transport = {
    fetch: ff.fetch,
    sleep: async (ms: number) => { sleeps.push(ms); }
  };
  const result = await sendGeneration(config, [req("a.v1")], transport);
  expect(ff.calls.length).toBe(1);
  expect(sleeps).toStrictEqual([]);
  expect(result.answers[0]?.error).toBe("http 402: Insufficient credits. Add more using https://openrouter.ai/settings/credits");
});

test("Send Generation example 4: 503 then 200 with one backoff sleep", async () => {
  const config = fixtureJson("processor/glmConfig.json") as ProcessorConfig;
  const ff = fakeFetch({ [URL]: { status: 200, text: fixture("processor/okResponse.json") } });
  const sleeps: number[] = [];
  let made = 0;
  const transport: Transport = {
    fetch: async (url: string, init: { method: string; headers: Record<string, string>; body: string }) => {
      made += 1;
      if (made === 1) {
        return { status: 503, text: async () => "upstream down" };
      }
      return ff.fetch(url, init);
    },
    sleep: async (ms: number) => { sleeps.push(ms); }
  };
  const result = await sendGeneration(config, [req("a.v1")], transport);
  expect(made).toBe(2);
  expect(sleeps).toStrictEqual([1000]);
  expect(result.answers[0]?.finishReason).toBe("stop");
  expect(result.answers[0]?.error).toBeNull();
  expect(result.usage[0]?.inputTokens).toBe(11030);
});

test("Send Generation example 5: concurrency caps calls in flight", async () => {
  const config = {
    ...(fixtureJson("processor/glmConfig.json") as ProcessorConfig),
    concurrency: 2
  };
  const ff = fakeFetch({ [URL]: { status: 200, text: fixture("processor/okResponse.json") } });
  const sleeps: number[] = [];
  let live = 0;
  let peak = 0;
  const transport: Transport = {
    fetch: async (url: string, init: { method: string; headers: Record<string, string>; body: string }) => {
      live += 1;
      peak = Math.max(peak, live);
      await flush();
      live -= 1;
      return ff.fetch(url, init);
    },
    sleep: async (ms: number) => { sleeps.push(ms); }
  };
  const result = await sendGeneration(config, [req("r1.v1"), req("r2.v1"), req("r3.v1")], transport);
  expect(peak).toBeLessThanOrEqual(2);
  expect(ff.calls.length).toBe(3);
  expect(result.answers.map((a) => a.customId)).toStrictEqual(["r1.v1", "r2.v1", "r3.v1"]);
  expect(sleeps).toStrictEqual([]);
});

test("Send Generation example 6: the batch route submits and polls one batch", async () => {
  const config = fixtureJson("processor/batchConfig.json") as ProcessorConfig;
  const steps = [
    { status: 202, text: fixture("processor/batchSubmitted.json") },
    { status: 200, text: fixture("processor/batchCompleted.json") }
  ];
  const calls: { url: string; method: string; body: string | undefined }[] = [];
  const sleeps: number[] = [];
  const transport: Transport = {
    fetch: async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
      calls.push({ url, method: init.method, body: init.body });
      const s = steps[Math.min(calls.length, steps.length) - 1];
      return { status: s.status, text: async () => s.text };
    },
    sleep: async (ms: number) => { sleeps.push(ms); }
  };
  const result = await sendGeneration(config, [req("a.v1")], transport);
  expect(calls).toStrictEqual([
    {
      url: "https://openrouter.ai/api/beta/batches",
      method: "POST",
      body: calls[0]?.body
    },
    {
      url: "https://openrouter.ai/api/beta/batches/batch-1789576284-Ejahe4wq9AgVdp5xGdNm",
      method: "GET",
      body: undefined
    }
  ]);
  expect(calls[0]?.method).toBe("POST");
  expect(calls[1]?.method).toBe("GET");
  expect(calls[1]?.body).toBeUndefined();
  expect(sleeps).toStrictEqual([15000]);
  expect(result.answers).toStrictEqual([
    {
      customId: "a.v1",
      text: "```ts\nexport const a = 1;\n```",
      finishReason: "stop",
      error: null
    }
  ]);
  expect(result.usage[0]?.inputTokens).toBe(11030);
  expect(result.usage[0]?.outputTokens).toBe(571);
  expect(result.usage[0]?.cost).toBe(0.00269316);
});

test("Send Generation example 7: the stub answers on the batch route with no call", async () => {
  const r = tmpRoot();
  try {
    r.write("a.v1.md", "A\n");
    const config = {
      ...(fixtureJson("processor/glmConfig.json") as ProcessorConfig),
      type: "stub" as const,
      apiKey: null,
      model: "stub",
      route: "batch" as const,
      answersDir: r.root,
      providerOrder: null,
      reasoning: null
    };
    const ff = fakeFetch();
    const sleeps: number[] = [];
    const transport: Transport = {
      fetch: ff.fetch,
      sleep: async (ms: number) => { sleeps.push(ms); }
    };
    const result = await sendGeneration(config, [req("a.v1")], transport);
    expect(ff.calls.length).toBe(0);
    expect(sleeps).toStrictEqual([]);
    expect(result.answers[0]).toStrictEqual({
      customId: "a.v1",
      text: "A\n",
      finishReason: "stop",
      error: null
    });
  } finally {
    r.rm();
  }
});

test("Send Generation: an empty request list gives empty results", async () => {
  const config = fixtureJson("processor/glmConfig.json") as ProcessorConfig;
  const ff = fakeFetch();
  const sleeps: number[] = [];
  const transport: Transport = {
    fetch: ff.fetch,
    sleep: async (ms: number) => { sleeps.push(ms); }
  };
  const result = await sendGeneration(config, [], transport);
  expect(result).toStrictEqual({ answers: [], usage: [] });
  expect(ff.calls.length).toBe(0);
});

test("Send Generation: a stub config answers from files with no call", async () => {
  const r = tmpRoot();
  try {
    r.write("a.v1.md", "hello stub");
    const config = {
      ...(fixtureJson("processor/glmConfig.json") as ProcessorConfig),
      type: "stub" as const,
      apiKey: null,
      model: "stub",
      answersDir: r.root,
      providerOrder: null,
      reasoning: null
    };
    const ff = fakeFetch();
    const sleeps: number[] = [];
    const transport: Transport = {
      fetch: ff.fetch,
      sleep: async (ms: number) => { sleeps.push(ms); }
    };
    const result = await sendGeneration(config, [req("a.v1")], transport);
    expect(ff.calls.length).toBe(0);
    expect(sleeps).toStrictEqual([]);
    expect(result.answers[0]).toStrictEqual({
      customId: "a.v1",
      text: "hello stub",
      finishReason: "stop",
      error: null
    });
    expect(result.usage[0]).toStrictEqual({
      customId: "a.v1",
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      provider: "stub",
      generationId: "stub-a.v1"
    });
  } finally {
    r.rm();
  }
});

test("Send Generation: maxRetries 0 gives one call, no sleep and no suffix", async () => {
  const config = {
    ...(fixtureJson("processor/glmConfig.json") as ProcessorConfig),
    maxRetries: 0
  };
  const ff = fakeFetch();
  ff.failAll(new Error("socket hang up"));
  const sleeps: number[] = [];
  const transport: Transport = {
    fetch: ff.fetch,
    sleep: async (ms: number) => { sleeps.push(ms); }
  };
  const result = await sendGeneration(config, [req("a.v1")], transport);
  expect(ff.calls.length).toBe(1);
  expect(sleeps).toStrictEqual([]);
  expect(result.answers[0]?.error).toBe("transport: socket hang up");
  expect(result.usage[0]).toStrictEqual({
    customId: "a.v1",
    inputTokens: 0,
    outputTokens: 0,
    cost: null,
    provider: null,
    generationId: null
  });
});

test("Send Generation: 429 is retryable, 400 is final at once", async () => {
  const config = {
    ...(fixtureJson("processor/glmConfig.json") as ProcessorConfig),
    maxRetries: 1
  };
  const sleeps: number[] = [];
  let made = 0;
  const transport: Transport = {
    fetch: async () => {
      made += 1;
      if (made === 1) {
        return { status: 429, text: async () => "slow down" };
      }
      return { status: 400, text: async () => '{"error":{"message":"bad request"}}' };
    },
    sleep: async (ms: number) => { sleeps.push(ms); }
  };
  const result = await sendGeneration(config, [req("a.v1")], transport);
  expect(made).toBe(2);
  expect(sleeps).toStrictEqual([1000]);
  expect(result.answers[0]?.error).toBe("http 400: bad request");
});

test("Send Generation: a 500 answer keeps the usage of the last paid call", async () => {
  const config = {
    ...(fixtureJson("processor/glmConfig.json") as ProcessorConfig),
    maxRetries: 1
  };
  const sleeps: number[] = [];
  let made = 0;
  const transport: Transport = {
    fetch: async () => {
      made += 1;
      return { status: 500, text: async () => '{"id":"gen-x","usage":{"prompt_tokens":7,"completion_tokens":3,"cost":0.001}}' };
    },
    sleep: async (ms: number) => { sleeps.push(ms); }
  };
  const result = await sendGeneration(config, [req("a.v1")], transport);
  expect(made).toBe(2);
  expect(sleeps).toStrictEqual([1000]);
  expect(result.answers[0]?.error).toBe("http 500: {\"id\":\"gen-x\",\"usage\":{\"prompt_tokens\":7,\"completion_tokens\":3,\"cost\":0.001}} (after 2 attempts)");
  expect(result.usage[0]).toStrictEqual({
    customId: "a.v1",
    inputTokens: 7,
    outputTokens: 3,
    cost: 0.001,
    provider: null,
    generationId: "gen-x"
  });
});

test("Send Generation: BACKOFF_MS is 1000", () => {
  expect(BACKOFF_MS).toBe(1000);
});
