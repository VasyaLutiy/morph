import { describe, expect, test } from "vitest";
import type { Request } from "../../src/compiler/types.js";
import { readResponse } from "../../src/processor/response.js";
import { stubAnswer } from "../../src/processor/stub.js";
import type { ProcessorConfig, Reply } from "../../src/processor/types.js";
import { fixture, tmpRoot } from "../helpers.js";

function stubConfig(answersDir: string): ProcessorConfig {
  return {
    id: "st",
    type: "stub",
    model: "stub",
    apiKey: null,
    baseUrl: "https://openrouter.ai/api/v1",
    route: "sync",
    concurrency: 1,
    providerOrder: null,
    reasoning: null,
    timeoutMs: 600000,
    maxRetries: 2,
    answersDir
  };
}

function request(customId: string): Request {
  return {
    customId,
    model: null,
    maxTokens: null,
    reasoning: null,
    messages: [{ role: "user", content: "write it" }]
  };
}

describe("Read Response", () => {
  test("Read Response example 1: ok reply with content, stop and usage", () => {
    const reply: Reply = readResponse("a.v1", 200, fixture("processor/okResponse.json"));
    expect(reply.answer).toStrictEqual({
      customId: "a.v1",
      text: "```ts\nexport const a = 1;\n```",
      finishReason: "stop",
      error: null
    });
    expect(reply.usage).toStrictEqual({
      customId: "a.v1",
      inputTokens: 11030,
      outputTokens: 571,
      cost: 0.00538632,
      provider: "Novita",
      generationId: "gen-0000000001-TESTtestTESTtestTEST"
    });
  });

  test("Read Response example 2: length reply with null content keeps usage", () => {
    const reply: Reply = readResponse("a.v2", 200, fixture("processor/lengthResponse.json"));
    expect(reply.answer).toStrictEqual({
      customId: "a.v2",
      text: null,
      finishReason: "length",
      error: null
    });
    expect(reply.usage).toStrictEqual({
      customId: "a.v2",
      inputTokens: 15550,
      outputTokens: 12000,
      cost: 0.0172,
      provider: "Novita",
      generationId: "gen-0000000002-TESTtestTESTtestTEST"
    });
  });

  test("Read Response example 3: http 402 error body", () => {
    const reply: Reply = readResponse("a.v1", 402, fixture("processor/errorResponse.json"));
    expect(reply.answer).toStrictEqual({
      customId: "a.v1",
      text: null,
      finishReason: null,
      error: "http 402: Insufficient credits. Add more using https://openrouter.ai/settings/credits"
    });
    expect(reply.usage).toStrictEqual({
      customId: "a.v1",
      inputTokens: 0,
      outputTokens: 0,
      cost: null,
      provider: null,
      generationId: null
    });
  });

  test("Read Response example 4: non-JSON body is unreadable", () => {
    const reply: Reply = readResponse("a.v1", 200, "<html>bad gateway</html>");
    expect(reply.answer).toStrictEqual({
      customId: "a.v1",
      text: null,
      finishReason: null,
      error: "unreadable response: <html>bad gateway</html>"
    });
    expect(reply.usage).toStrictEqual({
      customId: "a.v1",
      inputTokens: 0,
      outputTokens: 0,
      cost: null,
      provider: null,
      generationId: null
    });
  });
});

describe("Stub Answer", () => {
  test("Stub Answer example 1: primary file answers with its exact bytes", () => {
    const r = tmpRoot();
    try {
      r.write("a.v1.md", "```ts\nexport const a = 1;\n```\n");
      const reply: Reply = stubAnswer(request("a.v1"), stubConfig(r.root));
      expect(reply.answer).toStrictEqual({
        customId: "a.v1",
        text: "```ts\nexport const a = 1;\n```\n",
        finishReason: "stop",
        error: null
      });
      expect(reply.usage).toStrictEqual({
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

  test("Stub Answer example 2: version-stripped fallback answers a.v2 from a.md", () => {
    const r = tmpRoot();
    try {
      r.write("a.md", "A\n");
      const reply: Reply = stubAnswer(request("a.v2"), stubConfig(r.root));
      expect(reply.answer.text).toBe("A\n");
      expect(reply.answer.finishReason).toBe("stop");
      expect(reply.usage.generationId).toBe("stub-a.v2");
    } finally {
      r.rm();
    }
  });

  test("Stub Answer example 3: empty answersDir names the missing primary path", () => {
    const r = tmpRoot();
    try {
      const reply: Reply = stubAnswer(request("b.v1"), stubConfig(r.root));
      expect(reply.answer.text).toBe(null);
      expect(reply.answer.finishReason).toBe(null);
      expect(reply.answer.error).toBe("stub has no answer: " + r.path("b.v1.md"));
    } finally {
      r.rm();
    }
  });
});

describe("Read Response, own checks", () => {
  test("http error without a message slices the body", () => {
    const reply: Reply = readResponse("a.v1", 500, "x".repeat(300));
    expect(reply.answer.error).toBe("http 500: " + "x".repeat(200));
    expect(reply.answer.text).toBe(null);
  });

  test("status 500 with usage in the body keeps it", () => {
    const body = JSON.stringify({
      id: "gen-x",
      provider: "Novita",
      usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.01 }
    });
    const reply: Reply = readResponse("a.v1", 500, body);
    expect(reply.usage.inputTokens).toBe(10);
    expect(reply.usage.outputTokens).toBe(5);
    expect(reply.usage.cost).toBe(0.01);
    expect(reply.usage.provider).toBe("Novita");
  });

  test("provider error without a message stringifies the error object", () => {
    const reply: Reply = readResponse("a.v1", 200, JSON.stringify({ error: { code: 7 } }));
    expect(reply.answer.error).toBe('provider error: {"code":7}');
    expect(reply.answer.text).toBe(null);
  });

  test("no choices gives provider error: no choices", () => {
    const reply: Reply = readResponse("a.v1", 200, JSON.stringify({ choices: [] }));
    expect(reply.answer.error).toBe("provider error: no choices");
  });

  test("array body is unreadable", () => {
    const reply: Reply = readResponse("a.v1", 200, "[1,2]");
    expect(reply.answer.error).toBe("unreadable response: [1,2]");
  });

  test("usage zero fields on an ok reply without usage", () => {
    const reply: Reply = readResponse("a.v1", 200, JSON.stringify({ choices: [{ message: { content: "hi" } }] }));
    expect(reply.usage).toStrictEqual({
      customId: "a.v1",
      inputTokens: 0,
      outputTokens: 0,
      cost: null,
      provider: null,
      generationId: null
    });
    expect(reply.answer.text).toBe("hi");
  });
});

describe("Stub Answer, own checks", () => {
  test("only a final .v<n> is stripped: d.r1.v2 reads d.r1.md", () => {
    const r = tmpRoot();
    try {
      r.write("d.r1.md", "R1\n");
      const reply: Reply = stubAnswer(request("d.r1.v2"), stubConfig(r.root));
      expect(reply.answer.text).toBe("R1\n");
    } finally {
      r.rm();
    }
  });

  test("answersDir null gives a relative primary path in the error", () => {
    const reply: Reply = stubAnswer(request("z.v1"), stubConfig(""));
    expect(reply.answer.error).toBe("stub has no answer: z.v1.md");
  });

  test("usage is zero with stub markers even on a miss", () => {
    const r = tmpRoot();
    try {
      const reply: Reply = stubAnswer(request("c.v3"), stubConfig(r.root));
      expect(reply.usage).toStrictEqual({
        customId: "c.v3",
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        provider: "stub",
        generationId: "stub-c.v3"
      });
    } finally {
      r.rm();
    }
  });
});
