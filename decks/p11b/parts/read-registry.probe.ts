// P11b probe for read-registry: the batch route's default wait by docs/TASK_P11b_processor.md §2.2 (issue #4 item 4) —
// TIMEOUT_MS defaults to 3600000 on route batch, 600000 on route sync, a given TIMEOUT_MS wins. Record Read Registry
// example 5, then the §2.2 rows.
import { test, expect } from "vitest";
import { readRegistry } from "../../src/processor/registry.js";

test("Read Registry example 5: route batch waits 3600000 by default, a given TIMEOUT_MS wins, sync keeps 600000", () => {
  const got = readRegistry({
    MORPH_PROCESSOR_nb_TYPE: "openrouter", MORPH_PROCESSOR_nb_MODEL: "z-ai/glm-5.3:batch",
    MORPH_PROCESSOR_nb_API_KEY: "sk-or-test", MORPH_PROCESSOR_nb_ROUTE: "batch",
    MORPH_PROCESSOR_ns_TYPE: "stub", MORPH_PROCESSOR_ns_ANSWERS_DIR: "/x", MORPH_PROCESSOR_ns_ROUTE: "batch",
    MORPH_PROCESSOR_ns_TIMEOUT_MS: "90000",
    MORPH_PROCESSOR_sy_TYPE: "stub", MORPH_PROCESSOR_sy_ANSWERS_DIR: "/x",
  });
  expect(got.faults, "faults").toStrictEqual([]);
  expect(got.configs.map((c) => `${c.id} ${c.route} ${c.timeoutMs}`).join(", "), "id route timeoutMs")
    .toBe("nb batch 3600000, ns batch 90000, sy sync 600000");
  expect(got.configs[0], "nb whole").toStrictEqual({
    id: "nb", type: "openrouter", model: "z-ai/glm-5.3:batch", apiKey: "sk-or-test", baseUrl: "https://openrouter.ai/api/v1",
    route: "batch", concurrency: 1, providerOrder: null, reasoning: null, timeoutMs: 3600000, maxRetries: 2, answersDir: null,
  });
});

test("§2.2 rows: the default follows the route, not the type; a bad TIMEOUT_MS is still a fault on route batch", () => {
  const stub = readRegistry({ MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: "/x", MORPH_PROCESSOR_s_ROUTE: "batch" });
  expect(stub.configs[0]?.timeoutMs, "stub on route batch").toBe(3600000);
  const sync = readRegistry({ MORPH_PROCESSOR_o_TYPE: "openrouter", MORPH_PROCESSOR_o_MODEL: "m", MORPH_PROCESSOR_o_API_KEY: "k",
    MORPH_PROCESSOR_o_ROUTE: "sync" });
  expect(sync.configs[0]?.timeoutMs, "openrouter on route sync").toBe(600000);
  const given = readRegistry({ MORPH_PROCESSOR_o_TYPE: "openrouter", MORPH_PROCESSOR_o_MODEL: "m", MORPH_PROCESSOR_o_API_KEY: "k",
    MORPH_PROCESSOR_o_ROUTE: "batch", MORPH_PROCESSOR_o_TIMEOUT_MS: "600000" });
  expect(given.configs[0]?.timeoutMs, "a given 600000 on route batch").toBe(600000);
  const bad = readRegistry({ MORPH_PROCESSOR_o_TYPE: "openrouter", MORPH_PROCESSOR_o_MODEL: "m", MORPH_PROCESSOR_o_API_KEY: "k",
    MORPH_PROCESSOR_o_ROUTE: "batch", MORPH_PROCESSOR_o_TIMEOUT_MS: "0" });
  expect(`${bad.configs.length} ${bad.faults.map((f) => f.key).join(",")}`, "fault").toBe("0 MORPH_PROCESSOR_o_TIMEOUT_MS");
});
