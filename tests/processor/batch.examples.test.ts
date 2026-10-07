import { expect, test } from "vitest";
import { sendBatch } from "../../src/processor/batch.js";
import type { ProcessorConfig, Transport } from "../../src/processor/types.js";
import type { Request } from "../../src/compiler/types.js";
import { fixture, fixtureJson } from "../helpers.js";

type Step = Error | { status: number; text: string };

function ok(status: number, name: string): Step {
  return { status, text: fixture("processor/" + name) };
}

function script(steps: Step[]): {
  transport: Transport;
  calls: { url: string; method: string; body: string | undefined }[];
  sleeps: number[];
} {
  const calls: { url: string; method: string; body: string | undefined }[] = [];
  const sleeps: number[] = [];
  const transport: Transport = {
    fetch: async (url, init) => {
      calls.push({ url, method: init.method, body: init.body });
      const s = steps[Math.min(calls.length, steps.length) - 1];
      if (s instanceof Error) throw s;
      return { status: s.status, text: async () => s.text };
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  };
  return { transport, calls, sleeps };
}

function configWith(changes: Partial<ProcessorConfig>): ProcessorConfig {
  return { ...(fixtureJson("processor/batchConfig.json") as ProcessorConfig), ...changes };
}

function request(customId: string, model: string | null = null): Request {
  return { customId, model, maxTokens: null, reasoning: null, messages: [{ role: "user", content: "hi" }] };
}

const BATCH_URL = "https://openrouter.ai/api/beta/batches";
const BATCH_ID_URL = BATCH_URL + "/batch-1789576284-Ejahe4wq9AgVdp5xGdNm";

test("Send Batch example 1", async () => {
  const config = fixtureJson("processor/batchConfig.json") as ProcessorConfig;
  const { transport, calls, sleeps } = script([
    ok(202, "batchSubmitted.json"),
    ok(200, "batchInProgress.json"),
    ok(200, "batchCompleted.json"),
  ]);
  const result = await sendBatch(config, [request("a.v1"), request("b.v1"), request("c.v1"), request("d.v1")], transport);
  expect(calls.length).toBe(3);
  expect(calls[0]?.method).toBe("POST");
  expect(calls[0]?.url).toBe(BATCH_URL);
  expect(calls[1]?.method).toBe("GET");
  expect(calls[1]?.url).toBe(BATCH_ID_URL);
  expect(calls[1]?.body).toBeUndefined();
  expect(calls[2]?.method).toBe("GET");
  expect(calls[2]?.url).toBe(BATCH_ID_URL);
  expect(calls[2]?.body).toBeUndefined();
  expect(sleeps).toStrictEqual([15000, 15000]);
  expect(result.answers[0]).toStrictEqual({
    customId: "a.v1",
    text: "```ts\nexport const a = 1;\n```",
    finishReason: "stop",
    error: null,
  });
  expect(result.answers[1]).toStrictEqual({ customId: "b.v1", text: null, finishReason: "length", error: null });
  expect(result.answers[2]).toStrictEqual({
    customId: "c.v1",
    text: null,
    finishReason: null,
    error: "batch item error: context length exceeded",
  });
  expect(result.answers[3]).toStrictEqual({
    customId: "d.v1",
    text: null,
    finishReason: null,
    error: "batch batch-1789576284-Ejahe4wq9AgVdp5xGdNm completed: no result",
  });
  expect(result.usage[0]).toStrictEqual({
    customId: "a.v1",
    inputTokens: 11030,
    outputTokens: 571,
    cost: 0.00269316,
    provider: "Novita",
    generationId: "gen-0000000003-TESTtestTESTtestTEST",
  });
  expect(result.usage[3]).toStrictEqual({
    customId: "d.v1",
    inputTokens: 0,
    outputTokens: 0,
    cost: null,
    provider: null,
    generationId: null,
  });
});

test("Send Batch example 2", async () => {
  const config = fixtureJson("processor/batchConfig.json") as ProcessorConfig;
  const { transport, calls, sleeps } = script([
    ok(202, "batchSubmitted.json"),
    ok(404, "batchNotFound.json"),
    ok(200, "batchCompleted.json"),
  ]);
  const result = await sendBatch(config, [request("a.v1")], transport);
  expect(calls.length).toBe(3);
  expect(sleeps).toStrictEqual([15000, 15000]);
  expect(result.answers[0]).toStrictEqual({
    customId: "a.v1",
    text: "```ts\nexport const a = 1;\n```",
    finishReason: "stop",
    error: null,
  });
});

test("Send Batch example 3", async () => {
  const config = configWith({ timeoutMs: 120000 });
  const { transport, calls, sleeps } = script([
    ok(202, "batchSubmitted.json"),
    ok(200, "batchInProgress.json"),
    ok(200, "batchInProgress.json"),
    ok(200, "batchInProgress.json"),
    ok(200, "batchInProgress.json"),
    ok(404, "batchNotFound.json"),
  ]);
  const result = await sendBatch(config, [request("a.v1")], transport);
  expect(calls.length).toBe(6);
  expect(sleeps).toStrictEqual([15000, 15000, 15000, 15000, 15000]);
  expect(result.answers[0]?.error).toBe(
    "batch batch-1789576284-Ejahe4wq9AgVdp5xGdNm: http 404: Batch job batch-1789576284-Ejahe4wq9AgVdp5xGdNm not found."
  );
});

test("Send Batch example 4", async () => {
  const config = fixtureJson("processor/batchConfig.json") as ProcessorConfig;
  const { transport, calls, sleeps } = script([ok(202, "batchSubmitted.json"), ok(200, "batchFailed.json")]);
  const result = await sendBatch(config, [request("a.v1"), request("b.v1")], transport);
  expect(calls.length).toBe(2);
  expect(sleeps).toStrictEqual([15000]);
  const expected =
    "batch batch-1789576284-Ejahe4wq9AgVdp5xGdNm failed: HTTP 400: invalid batch inference job: job-submission-count for account acct-0000, in use: 16, quota: 16";
  expect(result.answers[0]?.error).toBe(expected);
  expect(result.answers[1]?.error).toBe(expected);
});

test("Send Batch example 5", async () => {
  const config = fixtureJson("processor/batchConfig.json") as ProcessorConfig;
  const { transport, calls, sleeps } = script([ok(400, "noBatchEndpoint.json")]);
  const result = await sendBatch(config, [request("a.v1"), request("b.v1")], transport);
  expect(calls.length).toBe(1);
  expect(sleeps).toStrictEqual([]);
  const expected =
    'batch submit: http 400: HTTP 400: invalid batch inference job: Model \'z-ai/glm-5.3:batch\' does not have a :batch endpoint.';
  expect(result.answers[0]?.error).toBe(expected);
  expect(result.answers[1]?.error).toBe(expected);
});

test("Send Batch example 6", async () => {
  const config = fixtureJson("processor/batchConfig.json") as ProcessorConfig;
  const { transport, calls, sleeps } = script([ok(202, "batchSubmitted.json"), ok(200, "batchInProgress.json")]);
  const result = await sendBatch(config, [request("a.v1")], transport);
  expect(calls.length).toBe(5);
  expect(sleeps).toStrictEqual([15000, 15000, 15000, 15000]);
  expect(result.answers[0]?.error).toBe("batch batch-1789576284-Ejahe4wq9AgVdp5xGdNm still in_progress after 4 polls");
  expect(result.usage[0]).toStrictEqual({
    customId: "a.v1",
    inputTokens: 0,
    outputTokens: 0,
    cost: null,
    provider: null,
    generationId: null,
  });
});

test("Send Batch example 7", async () => {
  const config = fixtureJson("processor/batchConfig.json") as ProcessorConfig;
  const { transport, calls, sleeps } = script([
    ok(202, "batchSubmitted.json"),
    new Error("socket hang up"),
    ok(200, "batchCompleted.json"),
  ]);
  const result = await sendBatch(config, [request("x.v1", "other/m"), request("a.v1")], transport);
  expect(calls.length).toBe(3);
  const body = JSON.parse(calls[0]?.body ?? "null") as { requests: { custom_id: string }[] };
  expect(body.requests.map((r) => r.custom_id)).toStrictEqual(["a.v1"]);
  expect(sleeps).toStrictEqual([15000, 15000]);
  expect(result.answers[0]).toStrictEqual({
    customId: "x.v1",
    text: null,
    finishReason: null,
    error: "batch runs one model: x.v1 pins other/m, the batch is z-ai/glm-5.3:batch",
  });
  expect(result.answers[1]).toStrictEqual({
    customId: "a.v1",
    text: "```ts\nexport const a = 1;\n```",
    finishReason: "stop",
    error: null,
  });
});
