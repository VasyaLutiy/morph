// P9b probe for build-retry: buildRetry by docs/TASK_P9b_runloop.md §2.2, the NEW record example
// (Component runloop, Function Build Retry, example 4; 1-3 stay pinned by tests/runloop/retry.examples.test.ts),
// then the §2.2 rows: the closing sentence only with a diff, and the base id on a second retry.
import { test, expect } from "vitest";
import { buildRetry } from "../../src/runloop/retry.js";
import type { Card } from "../../src/cards/types.js";

const card = (customId: string): Card => ({ customId, intent: "generate", targets: ["src/c.ts"], contextSlice: ["docs/c.md"],
  instruction: "Write c.", acceptance: "exit 0", model: null, maxTokens: 1000, reasoning: null, variants: 2, dependsOn: ["x"] });
const HEAD = "Write c.\n\nYour previous attempt failed its acceptance. Fix exactly what the acceptance reports and return the whole file again.\nAcceptance output:\n";
const TAIL = "\n\nThe diff above is your own previous edit: correct it where it went wrong instead of rewriting the files from scratch.";

test("Build Retry example 4: the diff block ends with the correct-not-rewrite sentence", () => {
  const r = buildRetry(card("c"), 1, "red\n", "@@ -1,1 +1,1 @@\n-a\n+b\n");
  expect(r.instruction, "instruction").toBe(
    "Write c.\n\nYour previous attempt failed its acceptance. Fix exactly what the acceptance reports and return the whole file again.\nAcceptance output:\nred\n\n\nYour previous attempt (rejected):\n@@ -1,1 +1,1 @@\n-a\n+b\n\n\nThe diff above is your own previous edit: correct it where it went wrong instead of rewriting the files from scratch.",
  );
  expect(r.customId, "customId").toBe("c.r1");
});

test("§2.2: no diff, no closing sentence", () => {
  const r = buildRetry(card("c.r1"), 2, "still red", null);
  expect(r.instruction, "instruction").toBe(HEAD + "still red");
  expect(r.instruction.includes(TAIL), "no closing sentence").toBe(false);
  expect(r.customId, "customId").toBe("c.r2");
});

test("§2.2: an empty-string diff still gets the block (null is the only no-diff value)", () => {
  const r = buildRetry(card("c"), 1, "o", "");
  expect(r.instruction, "instruction").toBe(HEAD + "o\n\nYour previous attempt (rejected):\n" + TAIL);
  expect(r.dependsOn, "dependsOn").toStrictEqual([]);
});
