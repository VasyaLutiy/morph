// P4 probe for read-registry: readRegistry by docs/TASK_P4_processor.md §2.2, one test per
// record example (Component processor, Function Read Registry), then every boundary row of
// the §2.2 table. Values and types; null is checked as null, never through `??`.
import { test, expect } from "vitest";
import { DEFAULT_BASE_URL, KEYS, PREFIX, readRegistry } from "../../src/processor/registry.js";
import type { ProcessorConfig, Registry } from "../../src/processor/types.js";
import type { Fault } from "../../src/cards/types.js";
import { fixtureJson } from "../../tests/helpers.js";

const lines = (fs: Fault[]): string => fs.map((f) => `${f.key} | ${f.message}`).join("\n");
const ids = (r: Registry): string => r.configs.map((c) => c.id).join(",");

test("Read Registry example 1: the glm53 processor, PATH ignored", () => {
  const got: Registry = readRegistry({
    PATH: "/usr/bin:/bin",
    MORPH_PROCESSOR_glm53_TYPE: "openrouter",
    MORPH_PROCESSOR_glm53_MODEL: "z-ai/glm-5.3",
    MORPH_PROCESSOR_glm53_API_KEY: "sk-or-test",
    MORPH_PROCESSOR_glm53_CONCURRENCY: "4",
    MORPH_PROCESSOR_glm53_PROVIDER_ORDER: "Novita, Together",
    MORPH_PROCESSOR_glm53_REASONING_MAX_TOKENS: "2500",
  });
  expect(lines(got.faults), "faults").toBe("");
  expect(got.configs.length, "one config").toBe(1);
  const want = fixtureJson("processor/glmConfig.json") as ProcessorConfig;
  const c: ProcessorConfig = got.configs[0] as ProcessorConfig;
  expect(c, "the config of processor/glmConfig.json").toStrictEqual(want);
  expect(`${PREFIX} ${DEFAULT_BASE_URL} ${KEYS.length}`, "the constants").toBe(
    "MORPH_PROCESSOR_ https://openrouter.ai/api/v1 12");
});

test("Read Registry example 2: a stub with every default, the value trimmed", () => {
  const got = readRegistry({ MORPH_PROCESSOR_stub_TYPE: "stub", MORPH_PROCESSOR_stub_ANSWERS_DIR: " /tmp/answers " });
  expect(lines(got.faults), "faults").toBe("");
  expect(got.configs.length, "one config").toBe(1);
  const want: ProcessorConfig = {
    id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync",
    concurrency: 1, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 2, answersDir: "/tmp/answers",
  };
  expect(got.configs[0], "the stub config").toStrictEqual(want);
  expect(got.configs[0]?.apiKey === null, "apiKey is null (not undefined, not '')").toBe(true);
  expect(got.configs[0]?.providerOrder === null, "providerOrder is null").toBe(true);
});

test("Read Registry example 3: invalid processors are listed as faults, sorted by key", () => {
  const got = readRegistry({
    MORPH_PROCESSOR_a_TYPE: "openrouter",
    MORPH_PROCESSOR_b_TYPE: "stub", MORPH_PROCESSOR_b_ANSWERS_DIR: "/x", MORPH_PROCESSOR_b_CONCURRENCY: "0",
    MORPH_PROCESSOR_c_TYPE: "openai",
    MORPH_PROCESSOR_d_TYPE: "stub", MORPH_PROCESSOR_d_ANSWERS_DIR: "/x",
  });
  expect(ids(got), "only d is configured").toBe("d");
  expect(lines(got.faults), "four faults in key order").toBe([
    "MORPH_PROCESSOR_a_API_KEY | MORPH_PROCESSOR_a_API_KEY is required",
    "MORPH_PROCESSOR_a_MODEL | MORPH_PROCESSOR_a_MODEL is required",
    "MORPH_PROCESSOR_b_CONCURRENCY | MORPH_PROCESSOR_b_CONCURRENCY must be a positive integer (got '0')",
    "MORPH_PROCESSOR_c_TYPE | MORPH_PROCESSOR_c_TYPE must be one of openrouter, stub (got 'openai')",
  ].join("\n"));
});

test("Read Registry example 4: unknown keys, both reasoning levers, an id without TYPE", () => {
  const got = readRegistry({
    MORPH_PROCESSOR_e_TYPE: "stub", MORPH_PROCESSOR_e_ANSWERS_DIR: "/x", MORPH_PROCESSOR_e_REASONING_EFFORT: "low",
    MORPH_PROCESSOR_e_REASONING_MAX_TOKENS: "100", MORPH_PROCESSOR_e_FOO: "1", MORPH_PROCESSOR_x_y_TYPE: "stub",
  });
  expect(ids(got), "no config").toBe("");
  expect(lines(got.faults), "four faults in key order").toBe([
    "MORPH_PROCESSOR_e_FOO | MORPH_PROCESSOR_e_FOO is not a known key",
    "MORPH_PROCESSOR_e_REASONING_EFFORT | MORPH_PROCESSOR_e_REASONING_EFFORT conflicts with MORPH_PROCESSOR_e_REASONING_MAX_TOKENS: set one",
    "MORPH_PROCESSOR_x_TYPE | MORPH_PROCESSOR_x_TYPE is required",
    "MORPH_PROCESSOR_x_y_TYPE | MORPH_PROCESSOR_x_y_TYPE is not a known key",
  ].join("\n"));
});

test("§2.2 rows: every message of the table, one env each", () => {
  const one = (env: Record<string, string>): string => lines(readRegistry(env).faults);
  const S = { MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: "/x" };
  expect(one({ MORPH_PROCESSOR_TYPE: "stub" }), "no id").toBe(
    "MORPH_PROCESSOR_TYPE | MORPH_PROCESSOR_TYPE does not name MORPH_PROCESSOR_<id>_<KEY> with an id of [A-Za-z0-9-]");
  expect(one({ "MORPH_PROCESSOR_a.b_TYPE": "stub" }), "a dot in the id").toBe(
    "MORPH_PROCESSOR_a.b_TYPE | MORPH_PROCESSOR_a.b_TYPE does not name MORPH_PROCESSOR_<id>_<KEY> with an id of [A-Za-z0-9-]");
  expect(one({ MORPH_PROCESSOR_s_TYPE: "stub" }), "stub without ANSWERS_DIR").toBe(
    "MORPH_PROCESSOR_s_ANSWERS_DIR | MORPH_PROCESSOR_s_ANSWERS_DIR is required");
  expect(one({ MORPH_PROCESSOR_o_TYPE: "openrouter", MORPH_PROCESSOR_o_MODEL: "m", MORPH_PROCESSOR_o_API_KEY: "k",
    MORPH_PROCESSOR_o_ANSWERS_DIR: "/x" }), "ANSWERS_DIR on openrouter").toBe(
    "MORPH_PROCESSOR_o_ANSWERS_DIR | MORPH_PROCESSOR_o_ANSWERS_DIR is only for TYPE stub");
  expect(one({ ...S, MORPH_PROCESSOR_s_ROUTE: "fast" }), "route").toBe(
    "MORPH_PROCESSOR_s_ROUTE | MORPH_PROCESSOR_s_ROUTE must be one of sync, batch (got 'fast')");
  expect(one({ ...S, MORPH_PROCESSOR_s_TIMEOUT_MS: "1.5" }), "timeout").toBe(
    "MORPH_PROCESSOR_s_TIMEOUT_MS | MORPH_PROCESSOR_s_TIMEOUT_MS must be a positive integer (got '1.5')");
  expect(one({ ...S, MORPH_PROCESSOR_s_MAX_RETRIES: "-1" }), "retries").toBe(
    "MORPH_PROCESSOR_s_MAX_RETRIES | MORPH_PROCESSOR_s_MAX_RETRIES must be a non-negative integer (got '-1')");
  expect(one({ ...S, MORPH_PROCESSOR_s_REASONING_MAX_TOKENS: "0" }), "reasoning tokens").toBe(
    "MORPH_PROCESSOR_s_REASONING_MAX_TOKENS | MORPH_PROCESSOR_s_REASONING_MAX_TOKENS must be a positive integer (got '0')");
  expect(one({ ...S, MORPH_PROCESSOR_s_REASONING_EFFORT: "max" }), "effort").toBe(
    "MORPH_PROCESSOR_s_REASONING_EFFORT | MORPH_PROCESSOR_s_REASONING_EFFORT must be one of low, medium, high (got 'max')");
  expect(one({ MORPH_PROCESSOR_q_TYPE: "  " }), "an empty value is absent").toBe(
    "MORPH_PROCESSOR_q_TYPE | MORPH_PROCESSOR_q_TYPE is required");
  expect(one({ MORPH_PROCESSOR_b_TYPE: "x", MORPH_PROCESSOR_C_TYPE: "x" }), "faults by code unit: C before b").toBe([
    "MORPH_PROCESSOR_C_TYPE | MORPH_PROCESSOR_C_TYPE must be one of openrouter, stub (got 'x')",
    "MORPH_PROCESSOR_b_TYPE | MORPH_PROCESSOR_b_TYPE must be one of openrouter, stub (got 'x')",
  ].join("\n"));
});

test("§2.2 rows: values, defaults and ordering of a valid registry", () => {
  const got = readRegistry({
    MORPH_PROCESSOR_a_TYPE: "stub", MORPH_PROCESSOR_a_ANSWERS_DIR: "/a", MORPH_PROCESSOR_a_ROUTE: "batch",
    MORPH_PROCESSOR_a_MAX_RETRIES: "0", MORPH_PROCESSOR_a_TIMEOUT_MS: "5000", MORPH_PROCESSOR_a_REASONING_EFFORT: "high",
    MORPH_PROCESSOR_a_PROVIDER_ORDER: " , ", MORPH_PROCESSOR_a_MODEL: "own",
    MORPH_PROCESSOR_B_TYPE: "openrouter", MORPH_PROCESSOR_B_MODEL: "m", MORPH_PROCESSOR_B_API_KEY: "k",
    MORPH_PROCESSOR_B_BASE_URL: "http://127.0.0.1:9/v1", OTHER: "x",
  });
  expect(lines(got.faults), "faults").toBe("");
  expect(ids(got), "sorted by id in code-unit order (B before a, never localeCompare)").toBe("B,a");
  const z = got.configs[1] as ProcessorConfig;
  expect(`${z.route} ${z.maxRetries} ${z.timeoutMs} ${z.model}`, "route, retries, timeout, model").toBe("batch 0 5000 own");
  expect(JSON.stringify(z.reasoning), "effort lever").toBe('{"effort":"high"}');
  expect(z.providerOrder === null, "a list of blanks is null").toBe(true);
  expect((got.configs[0] as ProcessorConfig).baseUrl, "BASE_URL as given").toBe("http://127.0.0.1:9/v1");
  expect(readRegistry({}).configs.length + readRegistry({}).faults.length, "empty env").toBe(0);
});
