// P14a probe for plan-mutants by docs/TASK_P14_reviewer.md §2.2 (Plan Mutants) — the single-point mutants of one code file
// by MUTATION_RULES, outside strings, comments, import and export-list lines, sorted by line and column, spread by
// floor(i × total / limit) when they exceed the limit. Record Plan Mutants examples 1-3, then the §2.2 rows.
import { test, expect } from "vitest";
import { MUTATION_RULES, planMutants, quotedMask } from "../../src/reviewer/planMutants.js";
import type { Mutant } from "../../src/reviewer/planMutants.js";

const SRC = 'import { x } from "./x.js";\n// a < b in a comment\nexport function f(a: number, b: number): boolean {\n' +
  '  if (a === b && a > 0) return true;\n  return a + b >= 10 || s === "a < b"; // b - a\n}\n';
const at = (ms: Mutant[]) => ms.map((m) => [m.line, m.column, m.rule]);
const ALL = [[4, 9, "=== → !=="], [4, 15, "&& → ||"], [4, 20, "> → >="], [4, 32, "true → false"], [5, 12, "+ → -"],
  [5, 16, ">= → >"], [5, 22, "|| → &&"], [5, 27, "=== → !=="]];

test("Plan Mutants example 1: eight mutants of src/f.ts, none in the import, the comment or the string", () => {
  const ms = planMutants("src/f.ts", SRC, 50);
  expect(at(ms)).toStrictEqual(ALL);
  expect(ms[0].path).toBe("src/f.ts");
  expect(ms[0].text).toBe(SRC.replace("a === b", "a !== b"));
  expect(ms[7].text).toBe(SRC.replace('s === "a', 's !== "a'));
});

test("Plan Mutants example 2: the limit spreads, 0 gives none, a larger one all", () => {
  expect(at(planMutants("src/f.ts", SRC, 3))).toStrictEqual([ALL[0], ALL[2], ALL[5]]);
  expect(planMutants("src/f.ts", SRC, 0)).toStrictEqual([]);
  expect(at(planMutants("src/f.ts", SRC, 9))).toStrictEqual(ALL);
});

test("Plan Mutants example 3: quotedMask with an escaped quote; true and false only as whole words", () => {
  expect(quotedMask(`say("a\\"b", 'c') + 1`).map((b) => (b ? "1" : "0")).join("")).toBe("00001111110011100000");
  const ms = planMutants("src/t.ts", "const truey = trueish && untrue;\nconst t = true;\nconst u = !false;\n", 10);
  expect(at(ms)).toStrictEqual([[1, 23, "&& → ||"], [2, 11, "true → false"], [3, 12, "false → true"]]);
  expect(ms[2].text).toBe("const truey = trueish && untrue;\nconst t = true;\nconst u = !true;\n");
});

test("§2.2 rows: the twelve rules in order; every rule fires once on its line; skipped lines; the spread of 7 over 12", () => {
  expect(MUTATION_RULES.map((r) => [r.from, r.to, r.word])).toStrictEqual([
    ["===", "!==", false], ["!==", "===", false], [" <= ", " < ", false], [" >= ", " > ", false], [" < ", " <= ", false],
    [" > ", " >= ", false], [" + ", " - ", false], [" - ", " + ", false], ["&&", "||", false], ["||", "&&", false],
    ["true", "false", true], ["false", "true", true]]);
  const lines = ["a === b", "a !== b", "a <= b", "a >= b", "a < b", "a > b", "a + b", "a - b", "a && b", "a || b", "x(true)", "x(false)"];
  const ms = planMutants("m.ts", lines.join("\n"), 100);
  expect(at(ms)).toStrictEqual([[1, 3, "=== → !=="], [2, 3, "!== → ==="], [3, 3, "<= → <"], [4, 3, ">= → >"], [5, 3, "< → <="],
    [6, 3, "> → >="], [7, 3, "+ → -"], [8, 3, "- → +"], [9, 3, "&& → ||"], [10, 3, "|| → &&"], [11, 3, "true → false"],
    [12, 3, "false → true"]]);
  expect(ms[4].text.split("\n")[4]).toBe("a <= b");
  expect(ms[6].text.split("\n")[6]).toBe("a - b");
  expect(at(planMutants("m.ts", lines.join("\n"), 7)).map((r) => r[0])).toStrictEqual([1, 2, 4, 6, 7, 9, 11]);
  const skipped = "  // a === b\n  /* a === b */\n   * a === b\n# a === b\nimport x from 'y' && z;\nexport { a === b };\n" +
    "export type { T };\nexport const k = a === b;\nconst s = 'a === b' + `c && d`;\n";
  expect(at(planMutants("s.ts", skipped, 10))).toStrictEqual([[8, 20, "=== → !=="], [9, 21, "+ → -"]]);
  expect(at(planMutants("p.ts", "if (a === b) { c(); } // later a > b", 5))).toStrictEqual([[1, 7, "=== → !=="]]);
  expect(at(planMutants("q.ts", "const u = 'it''s' === x && \"q\\\"\" > y;", 5))).toStrictEqual(
    [[1, 19, "=== → !=="], [1, 25, "&& → ||"], [1, 34, "> → >="]]);
  expect(planMutants("e.ts", "", 3)).toStrictEqual([]);
});
