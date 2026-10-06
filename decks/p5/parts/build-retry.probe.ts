// P5 probe for build-retry: buildRetry by docs/TASK_P5_runloop.md §2.2, one test per record
// example (Component runloop, Function Build Retry), then a §2.2 row. Pure.
import { test, expect } from "vitest";
import { buildRetry } from "../../src/runloop/retry.js";
import type { Card } from "../../src/cards/types.js";

const card = (customId: string): Card => ({
  customId,
  intent: "generate",
  targets: ["src/a.ts"],
  contextSlice: ["docs/x.md"],
  instruction: "Write c.",
  acceptance: "exit 0",
  model: "m",
  maxTokens: 10,
  reasoning: null,
  variants: 2,
  dependsOn: ["dep"],
});

test("Build Retry example 1: the first retry carries the output and the diff", () => {
  const r = buildRetry(card("c"), 1, "exit 1\n", "@@ -1,1 +1,1 @@\n-old\n+new");
  expect(r.customId, "id").toBe("c.r1");
  expect(r.dependsOn, "deps cleared").toStrictEqual([]);
  expect(r.targets, "targets copied").toStrictEqual(["src/a.ts"]);
  expect(r.contextSlice, "slice copied").toStrictEqual(["docs/x.md"]);
  expect(`${r.variants} ${r.acceptance} ${r.model} ${r.maxTokens}`, "fields copied").toBe("2 exit 0 m 10");
  expect(r.instruction.startsWith("Write c."), "original kept").toBe(true);
  expect(r.instruction.includes("Acceptance output:\nexit 1"), "acceptance output").toBe(true);
  expect(r.instruction.includes("Your previous attempt (rejected):\n@@ -1,1 +1,1 @@"), "diff").toBe(true);
});

test("Build Retry example 2: a retry of a retry strips the base and omits an absent diff", () => {
  const r = buildRetry(card("c.r1"), 2, "still red", null);
  expect(r.customId, "id").toBe("c.r2");
  expect(r.instruction.includes("Your previous attempt (rejected):"), "no diff section").toBe(false);
  expect(r.instruction.endsWith("Acceptance output:\nstill red"), "ends with output").toBe(true);
});

test("Build Retry example 3: an attempt outside 1..2 throws", () => {
  expect(() => buildRetry(card("c"), 3, "x", null), "attempt 3").toThrowError("buildRetry: attempt must be 1 or 2");
  expect(() => buildRetry(card("c"), 0, "x", null), "attempt 0").toThrowError("buildRetry: attempt must be 1 or 2");
});
