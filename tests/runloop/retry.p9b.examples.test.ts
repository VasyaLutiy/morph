import { describe, expect, test } from "vitest";
import { buildRetry } from "../../src/runloop/retry.js";
import type { Card } from "../../src/cards/types.js";

const card = (customId: string, instruction: string): Card => ({
  customId,
  intent: "generate",
  targets: ["src/c.ts"],
  contextSlice: ["src/c.ts"],
  instruction,
  acceptance: "grep -q MARK src/c.ts",
  model: null,
  maxTokens: null,
  reasoning: null,
  variants: 2,
  dependsOn: ["a"]
});

describe("buildRetry", () => {
  test("Build Retry example 4: the full instruction with the diff and the closing sentence", () => {
    const retry = buildRetry(card("c", "Write c."), 1, "red\n", "@@ -1,1 +1,1 @@\n-a\n+b\n");
    expect(retry.instruction).toBe(
      "Write c.\n\n<acceptance_output>\nA previous attempt failed its acceptance check (`grep -q MARK src/c.ts`):\nred\n\n</acceptance_output>\nPlease fix the issues and produce the complete corrected file.\n\n<previous_attempt_diff>\nYour previous attempt changed the file like this (unified diff):\n@@ -1,1 +1,1 @@\n-a\n+b\n\n</previous_attempt_diff>\nThe diff above is YOUR OWN previous edit, not a proposed change: correct it where it went wrong rather than rewriting the file from scratch."
    );
  });

  test("Build Retry example 5: a discarded attempt is framed without the command and without a diff block", () => {
    const retry = buildRetry(card("c", "Write c."), 1, "answer truncated", null);
    expect(retry.instruction).toBe(
      "Write c.\n\n<acceptance_output>\nA previous attempt was discarded before acceptance could run:\nanswer truncated\n</acceptance_output>\nProduce the complete file again, from the context given above."
    );
  });

  test("Build Retry example 6: an empty string diff keeps the ran framing without a diff block", () => {
    const retry = buildRetry(card("c", "Write c."), 1, "red\n", "");
    expect(retry.instruction).toBe(
      "Write c.\n\n<acceptance_output>\nA previous attempt failed its acceptance check (`grep -q MARK src/c.ts`):\nred\n\n</acceptance_output>\nPlease fix the issues and produce the complete corrected file."
    );
  });

  test("Build Retry: the customId of a second retry strips one trailing .r<n>", () => {
    const retry = buildRetry(card("c.r1", "Write c."), 2, "still red\n", "@@ -1,1 +1,1 @@\n-a\n+b\n");
    expect(retry.customId).toBe("c.r2");
  });
});
