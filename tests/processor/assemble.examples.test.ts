import { describe, expect, test } from "vitest";
import type { Request } from "../../src/compiler/types.js";
import { assembleRequest } from "../../src/processor/assemble.js";
import type { ProcessorConfig } from "../../src/processor/types.js";
import { fixtureJson } from "../helpers.js";

const glmConfig = fixtureJson("processor/glmConfig.json") as ProcessorConfig;

const req1: Request = {
  customId: "a.v1",
  model: null,
  maxTokens: 12000,
  reasoning: null,
  messages: [{ role: "user", content: "hi" }],
};

const req2: Request = {
  customId: "b.v2",
  model: "x/y",
  maxTokens: null,
  reasoning: { effort: "low" },
  messages: [
    { role: "system", content: "s" },
    { role: "user", content: "u" },
  ],
};

describe("Assemble Request", () => {
  test("Assemble Request example 1: glm config, defaults and overrides from the request", () => {
    const p = assembleRequest(req1, glmConfig);
    expect(p.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(p.headers.Authorization).toBe("Bearer sk-or-test");
    expect(p.headers["Content-Type"]).toBe("application/json");
    expect(JSON.stringify(p.body)).toBe(
      '{"model":"z-ai/glm-5.3","messages":[{"role":"user","content":"hi"}],' +
        '"max_tokens":12000,"reasoning":{"max_tokens":2500},' +
        '"provider":{"order":["Novita","Together"],"allow_fallbacks":false},"usage":{"include":true}}'
    );
    expect("tool_choice" in p.body).toBe(false);
  });

  test("Assemble Request example 2: local baseUrl, providerOrder null, request overrides model and reasoning", () => {
    const config: ProcessorConfig = {
      ...glmConfig,
      baseUrl: "http://127.0.0.1:9/v1/",
      providerOrder: null,
    };
    const p = assembleRequest(req2, config);
    expect(p.url).toBe("http://127.0.0.1:9/v1/chat/completions");
    expect(p.headers.Authorization).toBe("Bearer sk-or-test");
    expect(p.headers["Content-Type"]).toBe("application/json");
    expect(JSON.stringify(p.body)).toBe(
      '{"model":"x/y","messages":[{"role":"system","content":"s"},{"role":"user","content":"u"}],' +
        '"reasoning":{"effort":"low"},"usage":{"include":true}}'
    );
    expect("max_tokens" in p.body).toBe(false);
    expect("provider" in p.body).toBe(false);
    expect("tool_choice" in p.body).toBe(false);
  });
});

describe("Assemble Request extra", () => {
  test("strips every trailing slash of baseUrl", () => {
    const config: ProcessorConfig = { ...glmConfig, baseUrl: "https://x.example///" };
    const p = assembleRequest(req1, config);
    expect(p.url).toBe("https://x.example/chat/completions");
  });

  test("no Authorization header when apiKey is null", () => {
    const config: ProcessorConfig = { ...glmConfig, apiKey: null };
    const p = assembleRequest(req1, config);
    expect("Authorization" in p.headers).toBe(false);
    expect(p.headers["Content-Type"]).toBe("application/json");
  });

  test("maxTokens 0 is sent as max_tokens 0", () => {
    const p = assembleRequest({ ...req1, maxTokens: 0 }, glmConfig);
    expect(JSON.stringify(p.body)).toBe(
      '{"model":"z-ai/glm-5.3","messages":[{"role":"user","content":"hi"}],' +
        '"max_tokens":0,"reasoning":{"max_tokens":2500},' +
        '"provider":{"order":["Novita","Together"],"allow_fallbacks":false},"usage":{"include":true}}'
    );
  });

  test("request reasoning maxTokens overrides the config reasoning", () => {
    const p = assembleRequest({ ...req1, reasoning: { maxTokens: 42 } }, glmConfig);
    expect(JSON.stringify(p.body.reasoning)).toBe('{"max_tokens":42}');
  });

  test("request model null with config reasoning null omits reasoning", () => {
    const config: ProcessorConfig = { ...glmConfig, reasoning: null };
    const p = assembleRequest({ ...req1, maxTokens: null }, config);
    expect(JSON.stringify(p.body)).toBe(
      '{"model":"z-ai/glm-5.3","messages":[{"role":"user","content":"hi"}],' +
        '"provider":{"order":["Novita","Together"],"allow_fallbacks":false},"usage":{"include":true}}'
    );
    expect("reasoning" in p.body).toBe(false);
  });

  test("messages are copied, not aliased", () => {
    const messages = [{ role: "user" as const, content: "hi" }];
    const p = assembleRequest({ ...req1, messages }, glmConfig);
    expect(p.body.messages).toStrictEqual([{ role: "user", content: "hi" }]);
    expect(p.body.messages).not.toBe(messages);
    expect(p.body.messages[0]).not.toBe(messages[0]);
  });

  test("providerOrder is copied, not aliased", () => {
    const order = ["Novita", "Together"];
    const config: ProcessorConfig = { ...glmConfig, providerOrder: order };
    const p = assembleRequest(req1, config);
    expect(p.body.provider?.order).toStrictEqual(["Novita", "Together"]);
    expect(p.body.provider?.order).not.toBe(order);
    expect(p.body.provider?.allow_fallbacks).toBe(false);
  });

  test("usage is always {include: true}", () => {
    const p = assembleRequest(req1, glmConfig);
    expect(JSON.stringify(p.body.usage)).toBe('{"include":true}');
  });

  test("no stream, temperature or tools keys", () => {
    const p = assembleRequest(req1, glmConfig);
    expect("stream" in p.body).toBe(false);
    expect("temperature" in p.body).toBe(false);
    expect("tools" in p.body).toBe(false);
    expect("tool_choice" in p.body).toBe(false);
  });

  test("body key order follows the interface order", () => {
    const p = assembleRequest(req1, glmConfig);
    expect(Object.keys(p.body)).toStrictEqual([
      "model",
      "messages",
      "max_tokens",
      "reasoning",
      "provider",
      "usage",
    ]);
  });
});
