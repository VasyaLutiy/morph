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
      "Write c.\n\nYour previous attempt failed its acceptance. Fix exactly what the acceptance reports and return the whole file again.\nAcceptance output:\nred\n\n\nYour previous attempt (rejected):\n@@ -1,1 +1,1 @@\n-a\n+b\n\n\nThe diff above is your own previous edit: correct it where it went wrong instead of rewriting the files from scratch."
    );
  });

  test("Build Retry: previousDiff null has no diff block and no closing sentence", () => {
    const retry = buildRetry(card("c", "Write c."), 1, "red\n", null);
    expect(retry.instruction).toBe(
      "Write c.\n\nYour previous attempt failed its acceptance. Fix exactly what the acceptance reports and return the whole file again.\nAcceptance output:\nred\n"
    );
    expect(retry.instruction.includes("Your previous attempt (rejected)")).toBe(false);
    expect(retry.instruction.includes("The diff above is your own previous edit")).toBe(false);
  });

  test("Build Retry: an empty string diff is not null and gets the block", () => {
    const retry = buildRetry(card("c", "Write c."), 1, "red\n", "");
    expect(retry.instruction).toBe(
      "Write c.\n\nYour previous attempt failed its acceptance. Fix exactly what the acceptance reports and return the whole file again.\nAcceptance output:\nred\n\n\nYour previous attempt (rejected):\n" +
        "" +
        "\n\nThe diff above is your own previous edit: correct it where it went wrong instead of rewriting the files from scratch."
    );
  });

  test("Build Retry: the customId of a second retry strips one trailing .r<n>", () => {
    const retry = buildRetry(card("c.r1", "Write c."), 2, "still red\n", "@@ -1,1 +1,1 @@\n-a\n+b\n");
    expect(retry.customId).toBe("c.r2");
  });
});
