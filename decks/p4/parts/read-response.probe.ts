// P4 probe for read-response: readResponse and stubAnswer by docs/TASK_P4_processor.md §2.2,
// one test per record example (Functions Read Response, then Stub Answer), then the boundary
// rows of §2.2. Every null is checked as null; answers and usage are compared whole.
import { test, expect } from "vitest";
import { readResponse } from "../../src/processor/response.js";
import { stubAnswer } from "../../src/processor/stub.js";
import type { Answer, ProcessorConfig, Reply, Usage } from "../../src/processor/types.js";
import type { Request } from "../../src/compiler/types.js";
import { fixture, fixtureJson, tmpRoot } from "../../tests/helpers.js";

const zero = (customId: string): Usage => ({ customId, inputTokens: 0, outputTokens: 0, cost: null, provider: null, generationId: null });
const failed = (customId: string, error: string): Answer => ({ customId, text: null, finishReason: null, error });

test("Read Response example 1: a recorded glm answer", () => {
  const got: Reply = readResponse("a.v1", 200, fixture("processor/okResponse.json"));
  expect(got.answer, "answer").toStrictEqual({ customId: "a.v1", text: "```ts\nexport const a = 1;\n```", finishReason: "stop", error: null });
  expect(got.usage, "usage").toStrictEqual({ customId: "a.v1", inputTokens: 11030, outputTokens: 571, cost: 0.00538632,
    provider: "Novita", generationId: "gen-0000000001-TESTtestTESTtestTEST" });
});

test("Read Response example 2: a paid truncation is an answer with no text, not an error", () => {
  const got = readResponse("a.v2", 200, fixture("processor/lengthResponse.json"));
  expect(got.answer, "answer").toStrictEqual({ customId: "a.v2", text: null, finishReason: "length", error: null });
  expect(`${got.usage.inputTokens} ${got.usage.outputTokens} ${got.usage.cost}`, "usage").toBe("15550 12000 0.0172");
});

test("Read Response example 3: a 402 refusal carries the provider's message", () => {
  const got = readResponse("a.v1", 402, fixture("processor/errorResponse.json"));
  expect(got.answer, "answer").toStrictEqual(failed("a.v1",
    "http 402: Insufficient credits. Add more using https://openrouter.ai/settings/credits"));
  expect(got.usage, "usage").toStrictEqual(zero("a.v1"));
});

test("Read Response example 4: a 200 that is not JSON", () => {
  const got = readResponse("a.v1", 200, "<html>bad gateway</html>");
  expect(got.answer, "answer").toStrictEqual(failed("a.v1", "unreadable response: <html>bad gateway</html>"));
  expect(got.usage, "usage").toStrictEqual(zero("a.v1"));
});

test("§2.2 rows of Read Response", () => {
  const long = "x".repeat(250);
  expect(readResponse("q", 503, "upstream down").answer.error, "non-JSON error body").toBe("http 503: upstream down");
  expect(readResponse("q", 500, long).answer.error, "first 200 chars").toBe("http 500: " + "x".repeat(200));
  expect(readResponse("q", 200, long).answer.error, "unreadable, first 200 chars").toBe("unreadable response: " + "x".repeat(200));
  expect(readResponse("q", 200, '{"error":{"code":502,"message":"Upstream error"}}').answer.error, "error object in a 200").toBe(
    "provider error: Upstream error");
  expect(readResponse("q", 200, '{"id":"g","choices":[]}').answer.error, "no choices").toBe("provider error: no choices");
  expect(readResponse("q", 200, "[1]").answer.error, "JSON that is not an object").toBe("unreadable response: [1]");
  const bare = readResponse("q", 200, '{"choices":[{"message":{"content":"t"}}]}');
  expect(bare.answer, "no finish_reason, no usage").toStrictEqual({ customId: "q", text: "t", finishReason: null, error: null });
  expect(bare.usage, "usage of a body without usage").toStrictEqual(zero("q"));
  const ok = fixtureJson("processor/okResponse.json") as { usage: { cost?: number } };
  delete ok.usage.cost;
  const noCost = readResponse("q", 200, JSON.stringify(ok)).usage;
  expect(noCost.cost === null, "cost absent is null").toBe(true);
  expect(`${noCost.inputTokens} ${noCost.provider}`, "the rest still read").toBe("11030 Novita");
  expect(readResponse("q", 429, fixture("processor/okResponse.json")).usage.inputTokens, "usage read on any status").toBe(11030);
  expect(readResponse("q", 299, fixture("processor/okResponse.json")).answer.finishReason, "299 is a success").toBe("stop");
  expect(readResponse("q", 300, "moved").answer.error, "300 is not").toBe("http 300: moved");
  expect(readResponse("q", 199, "early").answer.error, "199 is not").toBe("http 199: early");
});

const stubCfg = (dir: string): ProcessorConfig => ({
  id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync",
  concurrency: 1, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 2, answersDir: dir,
});
const rq = (customId: string): Request => ({ customId, model: null, maxTokens: null, reasoning: null, messages: [] });

test("Stub Answer example 1: the answer file of the variant", () => {
  const r = tmpRoot();
  try {
    r.write("a.v1.md", "```ts\nexport const a = 1;\n```\n");
    const got: Reply = stubAnswer(rq("a.v1"), stubCfg(r.root));
    expect(got.answer, "answer").toStrictEqual({ customId: "a.v1", text: "```ts\nexport const a = 1;\n```\n", finishReason: "stop", error: null });
    expect(got.usage, "usage").toStrictEqual({ customId: "a.v1", inputTokens: 0, outputTokens: 0, cost: 0, provider: "stub", generationId: "stub-a.v1" });
  } finally {
    r.rm();
  }
});

test("Stub Answer example 2: the card's file serves every variant", () => {
  const r = tmpRoot();
  try {
    r.write("a.md", "A\n");
    const got = stubAnswer(rq("a.v2"), stubCfg(r.root));
    expect(`${JSON.stringify(got.answer.text)} ${got.answer.finishReason} ${got.usage.generationId}`, "text, finish, id").toBe(
      '"A\\n" stop stub-a.v2');
  } finally {
    r.rm();
  }
});

test("Stub Answer example 3: no file is an error naming the variant's path", () => {
  const r = tmpRoot();
  try {
    const got = stubAnswer(rq("b.v1"), stubCfg(r.root));
    expect(got.answer, "answer").toStrictEqual(failed("b.v1", `stub has no answer: ${r.root}/b.v1.md`));
  } finally {
    r.rm();
  }
});

test("§2.2 rows of Stub Answer", () => {
  const r = tmpRoot();
  try {
    r.write("c.v1.md", "variant\n");
    r.write("c.md", "card\n");
    r.write("d.r1.md", "retry\n");
    expect(stubAnswer(rq("c.v1"), stubCfg(r.root)).answer.text, "the variant's file first").toBe("variant\n");
    expect(stubAnswer(rq("d.r1.v2"), stubCfg(r.root)).answer.text, "only the final .v<n> is stripped").toBe("retry\n");
    expect(stubAnswer(rq("d.v1"), stubCfg(r.root)).answer.error, "d.md does not exist").toBe(`stub has no answer: ${r.root}/d.v1.md`);
  } finally {
    r.rm();
  }
});
