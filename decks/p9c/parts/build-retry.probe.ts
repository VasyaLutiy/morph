// P9c probe for build-retry: buildRetry by docs/TASK_P9c_retry.md §2.2, one test per record example
// (Component runloop, Function Build Retry, examples 1-6), then the §2.2 rows: the command inserted as it
// is, the singular "the file" for several targets, the copied fields.
import { test, expect } from "vitest";
import { buildRetry } from "../../src/runloop/retry.js";
import type { Card } from "../../src/cards/types.js";

const card = (customId: string, acceptance = "grep -q MARK src/c.ts", targets = ["src/c.ts"]): Card => ({ customId,
  intent: "patch", targets, contextSlice: ["docs/c.md"], instruction: "Write c.", acceptance, model: "glm",
  maxTokens: 1000, reasoning: { effort: "high" }, variants: 2, dependsOn: ["x"] });
const RAN = "Write c.\n\n<acceptance_output>\nA previous attempt failed its acceptance check (`grep -q MARK src/c.ts`):\n";
const FIX = "\n</acceptance_output>\nPlease fix the issues and produce the complete corrected file.";
const GONE = "Write c.\n\n<acceptance_output>\nA previous attempt was discarded before acceptance could run:\n";
const AGAIN = "\n</acceptance_output>\nProduce the complete file again, from the context given above.";
const DIFF_HEAD = "\n\n<previous_attempt_diff>\nYour previous attempt changed the file like this (unified diff):\n";
const DIFF_TAIL = "\n</previous_attempt_diff>\nThe diff above is YOUR OWN previous edit, not a proposed change: correct it where it went wrong rather than rewriting the file from scratch.";

test("Build Retry example 1: the command and the output, then the diff block", () => {
  const r = buildRetry(card("c"), 1, "exit 1\n", "@@ -1,1 +1,1 @@\n-old\n+new");
  expect(r.customId, "customId").toBe("c.r1");
  expect(r.dependsOn, "dependsOn").toStrictEqual([]);
  expect(r.instruction.includes("A previous attempt failed its acceptance check (`grep -q MARK src/c.ts`):\nexit 1\n"), "header + output").toBe(true);
  expect(r.instruction.includes("Your previous attempt changed the file like this (unified diff):\n@@ -1,1 +1,1 @@"), "diff block").toBe(true);
  expect(r.instruction, "whole").toBe(RAN + "exit 1\n" + FIX + DIFF_HEAD + "@@ -1,1 +1,1 @@\n-old\n+new" + DIFF_TAIL);
});

test("Build Retry example 2: a second retry with no diff is the discarded framing", () => {
  const r = buildRetry(card("c.r1"), 2, "still red", null);
  expect(r.customId, "customId").toBe("c.r2");
  expect(r.instruction, "whole").toBe(GONE + "still red" + AGAIN);
  expect(r.instruction.includes("<previous_attempt_diff>"), "no diff block").toBe(false);
});

test("Build Retry example 3: attempt 3 throws", () => {
  expect(() => buildRetry(card("c"), 3, "x", null), "attempt 3").toThrowError("buildRetry: attempt must be 1 or 2");
  expect(() => buildRetry(card("c"), 0, "x", "d"), "attempt 0").toThrowError("buildRetry: attempt must be 1 or 2");
});

test("Build Retry example 4: the whole text with the command and the diff", () => {
  const r = buildRetry(card("c"), 1, "red\n", "@@ -1,1 +1,1 @@\n-a\n+b\n");
  expect(r.instruction, "instruction").toBe(
    "Write c.\n\n<acceptance_output>\nA previous attempt failed its acceptance check (`grep -q MARK src/c.ts`):\nred\n\n</acceptance_output>\nPlease fix the issues and produce the complete corrected file.\n\n<previous_attempt_diff>\nYour previous attempt changed the file like this (unified diff):\n@@ -1,1 +1,1 @@\n-a\n+b\n\n</previous_attempt_diff>\nThe diff above is YOUR OWN previous edit, not a proposed change: correct it where it went wrong rather than rewriting the file from scratch.",
  );
});

test("Build Retry example 5: previousDiff null is the discarded framing, no command", () => {
  const r = buildRetry(card("c"), 1, "answer truncated", null);
  expect(r.instruction, "instruction").toBe(
    "Write c.\n\n<acceptance_output>\nA previous attempt was discarded before acceptance could run:\nanswer truncated\n</acceptance_output>\nProduce the complete file again, from the context given above.",
  );
});

test("Build Retry example 6: an empty diff is the failed framing without the diff block", () => {
  const r = buildRetry(card("c"), 1, "red\n", "");
  expect(r.instruction, "instruction").toBe(
    "Write c.\n\n<acceptance_output>\nA previous attempt failed its acceptance check (`grep -q MARK src/c.ts`):\nred\n\n</acceptance_output>\nPlease fix the issues and produce the complete corrected file.",
  );
});

test("§2.2: the command goes between the backticks as it is, never escaped or clipped", () => {
  const cmd = 'echo `date` "$HOME" \'x\'\n' + "y".repeat(30000) + "\n(\n set -e\n)";
  const r = buildRetry(card("c", cmd), 1, "o", "d");
  expect(r.instruction.startsWith("Write c.\n\n<acceptance_output>\nA previous attempt failed its acceptance check (`" + cmd + "`):\no\n"), "raw command").toBe(true);
  expect(buildRetry({ ...card("c"), acceptance: null }, 1, "o", "d").instruction.includes("acceptance check (``):\no\n"),
    "a null acceptance is the empty command").toBe(true);
  expect(r.instruction.length, "nothing clipped").toBe(RAN.length - "grep -q MARK src/c.ts".length + cmd.length + 1 + FIX.length + DIFF_HEAD.length + 1 + DIFF_TAIL.length);
});

test("§2.2: several targets still read \"the file\"", () => {
  const r = buildRetry(card("c", "exit 1", ["src/a.ts", "src/b.ts"]), 1, "o", "d");
  expect(r.instruction.endsWith(DIFF_HEAD.replace("\n\n", "") + "d" + DIFF_TAIL), "singular texts").toBe(true);
  expect(r.instruction.includes("Please fix the issues and produce the complete corrected file."), "closing").toBe(true);
});

test("§2.2: every other field is copied, dependsOn emptied", () => {
  const c = card("a.r1.v1");
  const r = buildRetry(c, 1, "o", null);
  expect(r, "fields").toStrictEqual({ customId: "a.r1.v1.r1", intent: "patch", targets: ["src/c.ts"], contextSlice: ["docs/c.md"],
    instruction: GONE + "o" + AGAIN, acceptance: "grep -q MARK src/c.ts", model: "glm", maxTokens: 1000,
    reasoning: { effort: "high" }, variants: 2, dependsOn: [] });
});
