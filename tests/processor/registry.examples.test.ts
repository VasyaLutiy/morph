import { describe, expect, test } from "vitest";
import { DEFAULT_BASE_URL, KEYS, PREFIX, readRegistry } from "../../src/processor/registry.js";
import type { ProcessorConfig } from "../../src/processor/types.js";
import { fixtureJson } from "../helpers.js";

describe("readRegistry", () => {
  test("Read Registry example 1: one openrouter config from env", () => {
    const env = {
      PATH: "/usr/bin:/bin",
      MORPH_PROCESSOR_glm53_TYPE: "openrouter",
      MORPH_PROCESSOR_glm53_MODEL: "z-ai/glm-5.3",
      MORPH_PROCESSOR_glm53_API_KEY: "sk-or-test",
      MORPH_PROCESSOR_glm53_CONCURRENCY: "4",
      MORPH_PROCESSOR_glm53_PROVIDER_ORDER: "Novita, Together",
      MORPH_PROCESSOR_glm53_REASONING_MAX_TOKENS: "2500",
    };
    const registry = readRegistry(env);
    expect(registry.faults).toStrictEqual([]);
    expect(registry.configs).toStrictEqual([fixtureJson("processor/glmConfig.json")]);
  });

  test("Read Registry example 2: one stub config, values trimmed and defaulted", () => {
    const env = {
      MORPH_PROCESSOR_stub_TYPE: "stub",
      MORPH_PROCESSOR_stub_ANSWERS_DIR: " /tmp/answers ",
    };
    const registry = readRegistry(env);
    expect(registry.faults).toStrictEqual([]);
    expect(registry.configs).toStrictEqual([
      {
        id: "stub",
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
        answersDir: "/tmp/answers",
      },
    ]);
  });

  test("Read Registry example 3: only d survives, four faults in key order", () => {
    const env = {
      MORPH_PROCESSOR_a_TYPE: "openrouter",
      MORPH_PROCESSOR_b_TYPE: "stub",
      MORPH_PROCESSOR_b_ANSWERS_DIR: "/x",
      MORPH_PROCESSOR_b_CONCURRENCY: "0",
      MORPH_PROCESSOR_c_TYPE: "openai",
      MORPH_PROCESSOR_d_TYPE: "stub",
      MORPH_PROCESSOR_d_ANSWERS_DIR: "/x",
    };
    const registry = readRegistry(env);
    expect(registry.configs.map((c: ProcessorConfig) => c.id)).toStrictEqual(["d"]);
    expect(registry.faults).toStrictEqual([
      { key: "MORPH_PROCESSOR_a_API_KEY", message: "MORPH_PROCESSOR_a_API_KEY is required" },
      { key: "MORPH_PROCESSOR_a_MODEL", message: "MORPH_PROCESSOR_a_MODEL is required" },
      {
        key: "MORPH_PROCESSOR_b_CONCURRENCY",
        message: "MORPH_PROCESSOR_b_CONCURRENCY must be a positive integer (got '0')",
      },
      {
        key: "MORPH_PROCESSOR_c_TYPE",
        message: "MORPH_PROCESSOR_c_TYPE must be one of openrouter, stub (got 'openai')",
      },
    ]);
  });

  test("Read Registry example 4: an id with any fault yields no config, four faults in key order", () => {
    const env = {
      MORPH_PROCESSOR_e_TYPE: "stub",
      MORPH_PROCESSOR_e_ANSWERS_DIR: "/x",
      MORPH_PROCESSOR_e_REASONING_EFFORT: "low",
      MORPH_PROCESSOR_e_REASONING_MAX_TOKENS: "100",
      MORPH_PROCESSOR_e_FOO: "1",
      MORPH_PROCESSOR_x_y_TYPE: "stub",
    };
    const registry = readRegistry(env);
    expect(registry.configs).toStrictEqual([]);
    expect(registry.faults).toStrictEqual([
      { key: "MORPH_PROCESSOR_e_FOO", message: "MORPH_PROCESSOR_e_FOO is not a known key" },
      {
        key: "MORPH_PROCESSOR_e_REASONING_EFFORT",
        message:
          "MORPH_PROCESSOR_e_REASONING_EFFORT conflicts with MORPH_PROCESSOR_e_REASONING_MAX_TOKENS: set one",
      },
      { key: "MORPH_PROCESSOR_x_TYPE", message: "MORPH_PROCESSOR_x_TYPE is required" },
      { key: "MORPH_PROCESSOR_x_y_TYPE", message: "MORPH_PROCESSOR_x_y_TYPE is not a known key" },
    ]);
  });

  test("the constants: PREFIX, the 12 KEYS in interface order, DEFAULT_BASE_URL", () => {
    expect(PREFIX).toBe("MORPH_PROCESSOR_");
    expect(KEYS).toStrictEqual([
      "TYPE",
      "MODEL",
      "API_KEY",
      "BASE_URL",
      "ROUTE",
      "CONCURRENCY",
      "PROVIDER_ORDER",
      "REASONING_MAX_TOKENS",
      "REASONING_EFFORT",
      "TIMEOUT_MS",
      "MAX_RETRIES",
      "ANSWERS_DIR",
    ]);
    expect(DEFAULT_BASE_URL).toBe("https://openrouter.ai/api/v1");
  });

  test("variables without the PREFIX are ignored entirely", () => {
    const registry = readRegistry({
      PATH: "/usr/bin",
      MORPH_PROCESSORS: "a,b",
      OPENAI_API_KEY: "sk-x",
      MRPH_PROCESSOR_a_TYPE: "stub",
    });
    expect(registry.configs).toStrictEqual([]);
    expect(registry.faults).toStrictEqual([]);
  });

  test("a name with no id at all is a fault naming the pattern", () => {
    const registry = readRegistry({
      MORPH_PROCESSOR__TYPE: "stub",
    });
    expect(registry.configs).toStrictEqual([]);
    expect(registry.faults).toStrictEqual([
      {
        key: "MORPH_PROCESSOR__TYPE",
        message:
          "MORPH_PROCESSOR__TYPE does not name MORPH_PROCESSOR_<id>_<KEY> with an id of [A-Za-z0-9-]",
      },
    ]);
  });

  test("empty values are absent: TYPE set to spaces is a required fault", () => {
    const registry = readRegistry({
      MORPH_PROCESSOR_a_TYPE: "  ",
    });
    expect(registry.configs).toStrictEqual([]);
    expect(registry.faults).toStrictEqual([
      { key: "MORPH_PROCESSOR_a_TYPE", message: "MORPH_PROCESSOR_a_TYPE is required" },
    ]);
  });

  test("openrouter with ANSWERS_DIR and stub with API_KEY: one is a fault, the other is fine", () => {
    const registry = readRegistry({
      MORPH_PROCESSOR_a_TYPE: "openrouter",
      MORPH_PROCESSOR_a_MODEL: "m",
      MORPH_PROCESSOR_a_API_KEY: "k",
      MORPH_PROCESSOR_a_ANSWERS_DIR: "/x",
    });
    expect(registry.configs).toStrictEqual([]);
    expect(registry.faults).toStrictEqual([
      {
        key: "MORPH_PROCESSOR_a_ANSWERS_DIR",
        message: "MORPH_PROCESSOR_a_ANSWERS_DIR is only for TYPE stub",
      },
    ]);
    const registry2 = readRegistry({
      MORPH_PROCESSOR_b_TYPE: "stub",
      MORPH_PROCESSOR_b_API_KEY: "k",
      MORPH_PROCESSOR_b_ANSWERS_DIR: "/x",
    });
    expect(registry2.faults).toStrictEqual([]);
    expect(registry2.configs.map((c: ProcessorConfig) => c.id)).toStrictEqual(["b"]);
  });

  test("ROUTE, MAX_RETRIES and REASONING_EFFORT fault messages", () => {
    const registry = readRegistry({
      MORPH_PROCESSOR_a_TYPE: "stub",
      MORPH_PROCESSOR_a_ANSWERS_DIR: "/x",
      MORPH_PROCESSOR_a_ROUTE: "syncish",
      MORPH_PROCESSOR_a_MAX_RETRIES: "-1",
      MORPH_PROCESSOR_a_REASONING_EFFORT: "huge",
    });
    expect(registry.configs).toStrictEqual([]);
    expect(registry.faults).toStrictEqual([
      {
        key: "MORPH_PROCESSOR_a_MAX_RETRIES",
        message: "MORPH_PROCESSOR_a_MAX_RETRIES must be a non-negative integer (got '-1')",
      },
      {
        key: "MORPH_PROCESSOR_a_REASONING_EFFORT",
        message: "MORPH_PROCESSOR_a_REASONING_EFFORT must be one of low, medium, high (got 'huge')",
      },
      {
        key: "MORPH_PROCESSOR_a_ROUTE",
        message: "MORPH_PROCESSOR_a_ROUTE must be one of sync, batch (got 'syncish')",
      },
    ]);
  });

  test("BASE_URL is taken as given and PROVIDER_ORDER drops empty parts", () => {
    const registry = readRegistry({
      MORPH_PROCESSOR_a_TYPE: "openrouter",
      MORPH_PROCESSOR_a_MODEL: "m",
      MORPH_PROCESSOR_a_API_KEY: "k",
      MORPH_PROCESSOR_a_BASE_URL: "http://127.0.0.1:9/v1//",
      MORPH_PROCESSOR_a_PROVIDER_ORDER: " Novita , , Together ,",
    });
    expect(registry.faults).toStrictEqual([]);
    const config = registry.configs[0];
    expect(config?.baseUrl).toBe("http://127.0.0.1:9/v1//");
    expect(config?.providerOrder).toStrictEqual(["Novita", "Together"]);
    const registry2 = readRegistry({
      MORPH_PROCESSOR_a_TYPE: "openrouter",
      MORPH_PROCESSOR_a_MODEL: "m",
      MORPH_PROCESSOR_a_API_KEY: "k",
      MORPH_PROCESSOR_a_PROVIDER_ORDER: " , ,",
    });
    expect(registry2.faults).toStrictEqual([]);
    expect(registry2.configs[0]?.providerOrder).toStrictEqual(null);
  });

  test("reasoning effort and overridden defaults come through as config fields", () => {
    const registry = readRegistry({
      MORPH_PROCESSOR_a_TYPE: "stub",
      MORPH_PROCESSOR_a_MODEL: "mymodel",
      MORPH_PROCESSOR_a_ANSWERS_DIR: "/x",
      MORPH_PROCESSOR_a_ROUTE: "batch",
      MORPH_PROCESSOR_a_REASONING_EFFORT: "high",
      MORPH_PROCESSOR_a_TIMEOUT_MS: "1000",
      MORPH_PROCESSOR_a_MAX_RETRIES: "0",
    });
    expect(registry.faults).toStrictEqual([]);
    expect(registry.configs).toStrictEqual([
      {
        id: "a",
        type: "stub",
        model: "mymodel",
        apiKey: null,
        baseUrl: "https://openrouter.ai/api/v1",
        route: "batch",
        concurrency: 1,
        providerOrder: null,
        reasoning: { effort: "high" },
        timeoutMs: 1000,
        maxRetries: 0,
        answersDir: "/x",
      },
    ]);
  });

  test("configs and faults sort by code units, not locale: id B precedes id a", () => {
    const registry = readRegistry({
      MORPH_PROCESSOR_a_TYPE: "openai",
      MORPH_PROCESSOR_B_TYPE: "stub",
      MORPH_PROCESSOR_B_ANSWERS_DIR: "/x",
    });
    expect(registry.configs.map((c: ProcessorConfig) => c.id)).toStrictEqual(["B"]);
    expect(registry.faults.map((f) => f.key)).toStrictEqual(["MORPH_PROCESSOR_a_TYPE"]);
  });

  test("TIMEOUT_MS and REASONING_MAX_TOKENS of bad values are positive-integer faults", () => {
    const registry = readRegistry({
      MORPH_PROCESSOR_a_TYPE: "stub",
      MORPH_PROCESSOR_a_ANSWERS_DIR: "/x",
      MORPH_PROCESSOR_a_TIMEOUT_MS: "0",
      MORPH_PROCESSOR_a_REASONING_MAX_TOKENS: "x",
    });
    expect(registry.configs).toStrictEqual([]);
    expect(registry.faults).toStrictEqual([
      {
        key: "MORPH_PROCESSOR_a_REASONING_MAX_TOKENS",
        message: "MORPH_PROCESSOR_a_REASONING_MAX_TOKENS must be a positive integer (got 'x')",
      },
      {
        key: "MORPH_PROCESSOR_a_TIMEOUT_MS",
        message: "MORPH_PROCESSOR_a_TIMEOUT_MS must be a positive integer (got '0')",
      },
    ]);
  });

  test("a valid config needs nothing but TYPE, and an empty env gives nothing", () => {
    const empty = readRegistry({});
    expect(empty.configs).toStrictEqual([]);
    expect(empty.faults).toStrictEqual([]);
    const one = readRegistry({
      MORPH_PROCESSOR_a_TYPE: "stub",
      MORPH_PROCESSOR_a_ANSWERS_DIR: "/x",
    });
    expect(one.faults).toStrictEqual([]);
    expect(one.configs[0]?.id).toBe("a");
  });
});
