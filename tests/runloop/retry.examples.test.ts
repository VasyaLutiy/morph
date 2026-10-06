import { describe, expect, test } from "vitest";
import { buildRetry } from "../../src/runloop/retry.js";
import type { Card } from "../../src/cards/types.js";

function fullCard(overrides: Partial<Card>): Card {
  return {
    customId: "c",
    intent: "generate",
    targets: ["src/c.ts"],
    contextSlice: ["src/other.ts"],
    instruction: "Write c.",
    acceptance: "grep -q MARK src/c.ts",
    model: "stub",
    maxTokens: 1000,
    reasoning: null,
    variants: 2,
    dependsOn: ["a"],
    ...overrides,
  };
}

describe("buildRetry", () => {
  test("Build Retry example 1: retry of a fresh card with a previous diff", () => {
    const card = fullCard({ customId: "c" });
    const retry = buildRetry(card, 1, "exit 1\n", "@@ -1,1 +1,1 @@\n-old\n+new");
    expect(retry.customId).toBe("c.r1");
    expect(retry.dependsOn).toStrictEqual([]);
    expect(retry.instruction).toContain("Acceptance output:\nexit 1");
    expect(retry.instruction).toContain("Your previous attempt (rejected):\n@@ -1,1 +1,1 @@");
    expect(retry.targets).toStrictEqual(card.targets);
    expect(retry.contextSlice).toStrictEqual(card.contextSlice);
    expect(retry.acceptance).toBe(card.acceptance);
    expect(retry.variants).toBe(card.variants);
    expect(retry.instruction).toContain("Write c.");
  });

  test("Build Retry example 2: second retry strips the trailing .r1 and has no diff section", () => {
    const card = fullCard({ customId: "c.r1" });
    const retry = buildRetry(card, 2, "still red", null);
    expect(retry.customId).toBe("c.r2");
    expect(retry.instruction.endsWith("Acceptance output:\nstill red")).toBe(true);
    expect(retry.instruction.includes("Your previous attempt (rejected):")).toBe(false);
    expect(retry.dependsOn).toStrictEqual([]);
  });

  test("Build Retry example 3: attempt 3 throws", () => {
    const card = fullCard({});
    expect(() => buildRetry(card, 3, "log", null)).toThrowError(
      "buildRetry: attempt must be 1 or 2"
    );
  });

  test("Build Retry: attempt 0 throws the same message", () => {
    const card = fullCard({});
    expect(() => buildRetry(card, 0, "log", null)).toThrowError(
      "buildRetry: attempt must be 1 or 2"
    );
  });

  test("Build Retry: instruction addendum exact prefix", () => {
    const card = fullCard({ customId: "c" });
    const retry = buildRetry(card, 1, "boom", null);
    expect(retry.instruction).toContain(
      "Your previous attempt failed its acceptance. Fix exactly what the acceptance reports and return the whole file again."
    );
    expect(retry.instruction).toContain("Acceptance output:\nboom");
  });

  test("Build Retry: other card fields are copied", () => {
    const card = fullCard({
      customId: "card-x",
      intent: "patch",
      model: "glm",
      maxTokens: 500,
      reasoning: { effort: "high" },
    });
    const retry = buildRetry(card, 1, "log", null);
    expect(retry.intent).toBe("patch");
    expect(retry.model).toBe("glm");
    expect(retry.maxTokens).toBe(500);
    expect(retry.reasoning).toStrictEqual({ effort: "high" });
    expect(retry.instruction.startsWith(card.instruction)).toBe(true);
  });

  test("Build Retry: only the trailing retry suffix is stripped", () => {
    const card = fullCard({ customId: "a.r1.v1" });
    const retry = buildRetry(card, 1, "log", null);
    expect(retry.customId).toBe("a.r1.v1.r1");
  });

  test("Build Retry: null previousDiff keeps instruction shorter", () => {
    const card = fullCard({ customId: "c" });
    const withDiff = buildRetry(card, 1, "log", "diff");
    const withoutDiff = buildRetry(card, 1, "log", null);
    expect(withDiff.instruction.length).toBeGreaterThan(withoutDiff.instruction.length);
  });
});
