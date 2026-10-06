import { describe, expect, test } from "vitest";
import { outputDirective } from "../../src/compiler/directive.js";

describe("outputDirective", () => {
  test("one target: the single-target text verbatim", () => {
    expect(outputDirective(["src/a.ts"])).toBe(
      "Answer with the complete new content of src/a.ts in one fenced block and nothing else.",
    );
  });

  test("two targets: keeps the literal FILE: <path> placeholder and names both in order", () => {
    const text = outputDirective(["src/a.ts", "tests/a.test.ts"]);
    expect(text).toContain("`FILE: <path>`");
    expect(text.endsWith(
      "The targets, in this order: src/a.ts, tests/a.test.ts.",
    )).toBe(true);
  });

  test("empty targets: throws an Error whose message starts with outputDirective", () => {
    expect(() => outputDirective([])).toThrow(/^outputDirective/);
  });
});
