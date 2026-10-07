import { describe, expect, test } from "vitest";
import { outputDirective } from "../../src/compiler/directive.js";

describe("outputDirective smoke", () => {
  test("one target: first line announces the single fenced block", () => {
    const text = outputDirective(["src/a.ts"]);
    expect(text.startsWith(
      "Return the complete content of src/a.ts as ONE fenced block, and nothing else:",
    )).toBe(true);
  });

  test("several targets: first line carries the decimal count", () => {
    const text = outputDirective(["src/a.ts", "tests/a.test.ts"]);
    expect(text.startsWith("This card writes 2 files.")).toBe(true);
  });

  test("several targets: the two paths in the given order", () => {
    const text = outputDirective(["src/a.ts", "tests/a.test.ts"]);
    expect(text.includes("\nsrc/a.ts\ntests/a.test.ts\n\n")).toBe(true);
  });

  test("several targets: the text ends with the fence rule", () => {
    const text = outputDirective(["src/a.ts", "tests/a.test.ts"]);
    expect(text.endsWith(
      "so no line of a file may begin with three backticks.",
    )).toBe(true);
  });

  test("empty targets: throws an Error whose message starts with outputDirective", () => {
    expect(() => outputDirective([])).toThrow(/^outputDirective/);
  });
});
