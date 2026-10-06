// P2 probe for output-directive: outputDirective by docs/TASK_P2_compiler.md §2.2, one test per
// record example, values and types. Runs from probe/output-directive/ under vitest.
import { test, expect } from "vitest";
import { outputDirective } from "../../src/compiler/directive.js";

const ONE = "Answer with the complete new content of src/a.ts in one fenced block and nothing else.";
const MANY =
  "Answer with one section per file, each starting with a line `FILE: <path>` followed by one fenced block; " +
  "every target exactly once, no other text. The targets, in this order: src/a.ts, tests/a.test.ts.";

test("Output Directive example 1: two targets named in order with the literal 'FILE: '", () => {
  const d: string = outputDirective(["src/a.ts", "tests/a.test.ts"]);
  expect(d, "the several-targets text verbatim").toBe(MANY);
  expect(d.indexOf("src/a.ts") < d.indexOf("tests/a.test.ts"), "both paths in that order").toBe(true);
  expect(d.split("FILE: ").length - 1, "the literal line prefix once").toBe(1);
});

test("Output Directive §2.2: one target, three targets, empty targets throw", () => {
  expect(outputDirective(["src/a.ts"]), "one target").toBe(ONE);
  expect(outputDirective(["b.ts", "a.ts", "c.ts"]).endsWith("The targets, in this order: b.ts, a.ts, c.ts."), "array order, not sorted").toBe(true);
  expect(outputDirective(["src/a.ts"]).includes("FILE: "), "no FILE: for one target").toBe(false);
  expect(() => outputDirective([]), "empty targets").toThrow(/^outputDirective/);
});
