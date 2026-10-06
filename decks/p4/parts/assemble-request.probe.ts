// P4 probe for assemble-request: assembleRequest by docs/TASK_P4_processor.md §2.2, one test
// per record example (Component processor, Function Assemble Request), then the boundary
// rows of §2.2. The body is compared as the exact JSON text (key order pinned by §2.2).
import { test, expect } from "vitest";
import { assembleRequest } from "../../src/processor/assemble.js";
import type { ProcessorConfig, ProviderRequest } from "../../src/processor/types.js";
import type { Request } from "../../src/compiler/types.js";
import { fixtureJson } from "../../tests/helpers.js";

const glm = (): ProcessorConfig => fixtureJson("processor/glmConfig.json") as ProcessorConfig;
const req = (over: Partial<Request>): Request => ({
  customId: "a.v1", model: null, maxTokens: null, reasoning: null, messages: [{ role: "user", content: "hi" }], ...over,
});

test("Assemble Request example 1: the glm config pins the provider and the reasoning lever", () => {
  const got: ProviderRequest = assembleRequest(req({ maxTokens: 12000 }), glm());
  expect(got.url, "url").toBe("https://openrouter.ai/api/v1/chat/completions");
  expect(JSON.stringify(got.headers), "headers, in this order").toBe(
    '{"Authorization":"Bearer sk-or-test","Content-Type":"application/json"}');
  expect(JSON.stringify(got.body), "body").toBe(
    '{"model":"z-ai/glm-5.3","messages":[{"role":"user","content":"hi"}],"max_tokens":12000,' +
    '"reasoning":{"max_tokens":2500},"provider":{"order":["Novita","Together"],"allow_fallbacks":false},' +
    '"usage":{"include":true}}');
});

test("Assemble Request example 2: the request's model and effort win, nothing unasked is sent", () => {
  const cfg: ProcessorConfig = { ...glm(), baseUrl: "http://127.0.0.1:9/v1/", providerOrder: null };
  const got = assembleRequest(req({
    customId: "b.v2", model: "x/y", reasoning: { effort: "low" },
    messages: [{ role: "system", content: "s" }, { role: "user", content: "u" }],
  }), cfg);
  expect(got.url, "trailing slash stripped").toBe("http://127.0.0.1:9/v1/chat/completions");
  expect(JSON.stringify(got.body), "body").toBe(
    '{"model":"x/y","messages":[{"role":"system","content":"s"},{"role":"user","content":"u"}],' +
    '"reasoning":{"effort":"low"},"usage":{"include":true}}');
  expect("tool_choice" in got.body || "tools" in got.body || "stream" in got.body, "never tool_choice, tools, stream").toBe(false);
});

test("§2.2 rows: no lever at all, a null key, inputs untouched", () => {
  const cfg: ProcessorConfig = { ...glm(), apiKey: null, reasoning: null, providerOrder: null, baseUrl: "http://h//" };
  const r = req({ maxTokens: 0 });
  const got = assembleRequest(r, cfg);
  expect(got.url, "every trailing slash stripped").toBe("http://h/chat/completions");
  expect(JSON.stringify(got.headers), "no Authorization when apiKey is null").toBe('{"Content-Type":"application/json"}');
  expect(JSON.stringify(got.body), "maxTokens 0 is sent; no reasoning").toBe(
    '{"model":"z-ai/glm-5.3","messages":[{"role":"user","content":"hi"}],"max_tokens":0,"usage":{"include":true}}');
  expect(got.body.messages === r.messages, "messages are copied, not the request's array").toBe(false);
  const c2 = glm();
  const b2 = assembleRequest(req({ reasoning: { maxTokens: 64 } }), c2).body;
  expect(JSON.stringify(b2.reasoning), "the request's lever wins over the config's").toBe('{"max_tokens":64}');
  if (b2.provider) b2.provider.order.push("Mutated");
  expect(c2.providerOrder?.length, "providerOrder is copied").toBe(2);
});
