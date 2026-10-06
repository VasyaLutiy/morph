import { describe, expect, test } from "vitest";

import { outputDirective } from "../../src/compiler/directive.js";

const MULTI_TARGETS = ["src/a.ts", "tests/a.test.ts"];

const SEVERAL_TARGETS_TEXT =
  "Answer with one section per file, each starting with a line `FILE: <path>` " +
  "followed by one fenced block; every target exactly once, no other text. " +
  "The targets, in this order: src/a.ts, tests/a.test.ts.";

describe("outputDirective", () => {
  test("Output Directive example 1", () => {
    const got = outputDirective(MULTI_TARGETS);
    expect(got).toBe(SEVERAL_TARGETS_TEXT);
    expect(got.indexOf("src/a.ts")).toBeLessThan(got.indexOf("tests/a.test.ts"));
    expect(got.indexOf("FILE: ")).toBeGreaterThanOrEqual(0);
  });

  test("Output Directive: one target text verbatim", () => {
    expect(outputDirective(["src/a.ts"])).toBe(
      "Answer with the complete new content of src/a.ts in one fenced block and nothing else.",
    );
  });

  test("Output Directive: one target with a different path", () => {
    expect(outputDirective(["docs/B.md"])).toBe(
      "Answer with the complete new content of docs/B.md in one fenced block and nothing else.",
    );
  });

  test("Output Directive: several targets keep array order", () => {
    const got = outputDirective(["src/b.ts", "src/a.ts"]);
    expect(got.endsWith("The targets, in this order: src/b.ts, src/a.ts.")).toBe(true);
    expect(got.indexOf("src/b.ts")).toBeLessThan(got.indexOf("src/a.ts"));
  });

  test("Output Directive: two targets end with joined list and full stop", () => {
    const got = outputDirective(["x.ts", "y.ts"]);
    expect(got).toBe(
      "Answer with one section per file, each starting with a line `FILE: <path>` " +
        "followed by one fenced block; every target exactly once, no other text. " +
        "The targets, in this order: x.ts, y.ts.",
    );
  });

  test("Output Directive: three targets join with comma and space", () => {
    const got = outputDirective(["a.ts", "b.ts", "c.ts"]);
    expect(got.endsWith("The targets, in this order: a.ts, b.ts, c.ts.")).toBe(true);
  });

  test("Output Directive: literal FILE: appears exactly once in several-targets text", () => {
    const got = outputDirective(MULTI_TARGETS);
    const first = got.indexOf("FILE: ");
    expect(first).toBeGreaterThanOrEqual(0);
    expect(got.indexOf("FILE: ", first + 1)).toBe(-1);
  });

  test("Output Directive: no trailing newline on either shape", () => {
    expect(outputDirective(["src/a.ts"]).endsWith("\n")).toBe(false);
    expect(outputDirective(MULTI_TARGETS).endsWith("\n")).toBe(false);
  });

  test("Output Directive: empty targets throw with a naming message", () => {
    expect(() => outputDirective([])).toThrowError(/^outputDirective/);
  });

  test("Output Directive: several-targets text does not use the one-target sentence", () => {
    const got = outputDirective(MULTI_TARGETS);
    expect(got.includes("complete new content")).toBe(false);
  });
});
