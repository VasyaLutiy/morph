// P11 probe for assemble-batch: one generation's requests as one OpenRouter batch submission by
// docs/TASK_P11_processor.md §2.2 — url batchUrl(baseUrl) (a final /v1 becomes /beta, then /batches), headers as
// Assemble Request, body a JSON TEXT with endpoint, model, requests in this order; each item {custom_id, body} with
// max_tokens?, reasoning?, messages in this order; no model, provider or usage in any item. Record Assemble Batch
// examples 1-2, then the §2.2 rows.
import { test, expect, expectTypeOf } from "vitest";
import { assembleBatch, batchUrl } from "../../src/processor/batchRequest.js";
import type { BatchCall } from "../../src/processor/batchRequest.js";
import type { ProcessorConfig } from "../../src/processor/types.js";
import type { Request } from "../../src/compiler/types.js";
import { fixtureJson } from "../../tests/helpers.js";

const config = (): ProcessorConfig => fixtureJson("processor/batchConfig.json") as ProcessorConfig;
const req = (customId: string, over: Partial<Request> = {}): Request => ({
  customId, model: null, maxTokens: null, reasoning: null, messages: [{ role: "user", content: "hi" }], ...over });

test("Assemble Batch example 1: two requests, the config's reasoning on the first, the request's on the second", () => {
  const got = assembleBatch([
    req("a.v1", { maxTokens: 12000 }),
    req("a.v2", { reasoning: { effort: "low" }, messages: [{ role: "system", content: "s" }, { role: "user", content: "u" }] }),
  ], config());
  expect(got.url, "url").toBe("https://openrouter.ai/api/beta/batches");
  expect(got.headers, "headers").toStrictEqual({ Authorization: "Bearer sk-or-test", "Content-Type": "application/json" });
  expect(Object.keys(got.headers).join(","), "header order").toBe("Authorization,Content-Type");
  expect(typeof got.body, "body is a JSON text").toBe("string");
  expect(got.body, "body").toBe('{"endpoint":"/v1/chat/completions","model":"z-ai/glm-5.3:batch","requests":[' +
    '{"custom_id":"a.v1","body":{"max_tokens":12000,"reasoning":{"max_tokens":2500},"messages":[{"role":"user","content":"hi"}]}},' +
    '{"custom_id":"a.v2","body":{"reasoning":{"effort":"low"},"messages":[{"role":"system","content":"s"},{"role":"user","content":"u"}]}}]}');
});

test("Assemble Batch example 2: no key, no reasoning, a /v1/ base; a request's own model is not sent", () => {
  const c: ProcessorConfig = { ...config(), apiKey: null, reasoning: null, baseUrl: "http://127.0.0.1:9/v1/" };
  const got = assembleBatch([req("b.v1", { model: "x/y" })], c);
  expect(got.url, "url").toBe("http://127.0.0.1:9/beta/batches");
  expect(got.headers, "headers").toStrictEqual({ "Content-Type": "application/json" });
  expect(got.body, "body").toBe('{"endpoint":"/v1/chat/completions","model":"z-ai/glm-5.3:batch","requests":' +
    '[{"custom_id":"b.v1","body":{"messages":[{"role":"user","content":"hi"}]}}]}');
  expect(batchUrl("http://h/x/"), "a base without /v1").toBe("http://h/x/batches");
});

test("Assemble Batch rows: batchUrl replaces only a FINAL /v1", () => {
  expect(batchUrl("https://openrouter.ai/api/v1"), "openrouter").toBe("https://openrouter.ai/api/beta/batches");
  expect(batchUrl("https://openrouter.ai/api/v1///"), "trailing slashes").toBe("https://openrouter.ai/api/beta/batches");
  expect(batchUrl("http://h/v1x"), "v1x is not /v1").toBe("http://h/v1x/batches");
  expect(batchUrl("http://h/v1/api"), "inner /v1 kept").toBe("http://h/v1/api/batches");
});

test("Assemble Batch rows: the request's maxTokens and reasoning win; null maxTokens is absent; no extra key", () => {
  const got = assembleBatch([req("c.v1", { maxTokens: 7, reasoning: { maxTokens: 9 } }), req("c.v2")], config());
  const body = JSON.parse(got.body) as { requests: { custom_id: string; body: Record<string, unknown> }[] } & Record<string, unknown>;
  expect(Object.keys(body).join(","), "top keys").toBe("endpoint,model,requests");
  expect(Object.keys(body.requests[0] ?? {}).join(","), "item keys").toBe("custom_id,body");
  expect(JSON.stringify(body.requests[0]?.body), "request wins").toBe('{"max_tokens":7,"reasoning":{"max_tokens":9},"messages":[{"role":"user","content":"hi"}]}');
  expect(JSON.stringify(body.requests[1]?.body), "config reasoning, no max_tokens").toBe('{"reasoning":{"max_tokens":2500},"messages":[{"role":"user","content":"hi"}]}');
  expect(assembleBatch([], config()).body, "empty").toBe('{"endpoint":"/v1/chat/completions","model":"z-ai/glm-5.3:batch","requests":[]}');
});

test("Assemble Batch rows: the Batch Call type", () => {
  expectTypeOf<BatchCall>().toEqualTypeOf<{ url: string; headers: Record<string, string>; body: string }>();
  expectTypeOf(assembleBatch).returns.toEqualTypeOf<BatchCall>();
  expectTypeOf(batchUrl).toEqualTypeOf<(baseUrl: string) => string>();
});
