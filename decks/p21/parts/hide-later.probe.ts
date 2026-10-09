// P21 probe for hide-later by docs/TASK_P21a_breaking.md §2.2 (src/planner/hideLater.ts) — which Go files each card of
// an --only subset hides because the run has not written them yet (issue #12). Record Hide Later examples 1-4 on
// tests/fixtures/planner/hide.plan.json and hide.tree.json, then rows.
import { test, expect } from "vitest";
import { hideLater } from "../../src/planner/hideLater.js";
import type { GoTree } from "../../src/planner/hideLater.js";
import type { Plan } from "../../src/planner/types.js";
import { fixtureJson } from "../../tests/helpers.js";

const plan = (): Plan => fixtureJson("planner/hide.plan.json") as Plan;
const tree = (): GoTree => fixtureJson("planner/hide.tree.json") as GoTree;
const plus = (t: GoTree, file: string, imports: string[]): GoTree =>
  ({ files: [...t.files, file].sort(), imports: { ...t.imports, [file]: imports } });
const SV = "calc/scale_value_examples_test.go", RO = "calc/ratio_of.go", FL = "report/format_line.go";
const FLT = "report/format_line_examples_test.go", SU = "summary/summary.go", SUT = "summary/summary_examples_test.go";
const EX1 = { s: [FL, RO, SV, FLT, SU, SUT], f: [RO, SV, FLT, SU, SUT], r: [FL, SV, FLT, SU, SUT], sj: [FL, RO, FLT, SU, SUT],
  fj: [SU, SUT], m: [FLT, SUT], mj: [] };
const EX2 = { s: [RO, SV, FLT, SUT], f: [RO, SV, FLT, SUT], r: [SV, FLT, SUT], sj: [RO, FLT, SUT], fj: [SUT], m: [FLT, SUT], mj: [] };

test("Hide Later example 1: every other target of the card's generation and later ones, .go only", () => {
  expect(hideLater(plan(), tree())).toStrictEqual(EX1);
});

test("Hide Later example 2: a package hidden whole that a visible file imports stays, and so does what it imports", () => {
  expect(hideLater(plan(), plus(tree(), "cmd/tool/main.go", ["summary"]))).toStrictEqual(EX2);
});

test("Hide Later example 3: a kept test file in the package keeps it", () => {
  expect(hideLater(plan(), plus(tree(), "summary/legacy_test.go", []))).toStrictEqual(EX2);
});

test("Hide Later example 4: one generation hides nothing; a package with no non-test file on disk is not kept", () => {
  const p = plan();
  expect(hideLater({ ...p, cards: [p.cards[0]], generations: [["s"]], externalDependsOn: {} }, tree())).toStrictEqual({});
  const t = tree();
  const imports = { ...t.imports };
  delete imports[SU];
  const t4 = plus({ files: t.files.filter((f) => f !== SU), imports }, "cmd/tool/main.go", ["summary"]);
  expect(hideLater(p, t4)).toStrictEqual(EX1);
});

test("row: inputs unchanged; keys in plan order; a root-level package; nothing in the tree keeps nothing", () => {
  const p = plan(), t = plus(tree(), "cmd/tool/main.go", ["summary"]);
  const r = hideLater(p, t);
  expect([p, t]).toStrictEqual([plan(), plus(tree(), "cmd/tool/main.go", ["summary"])]);
  expect(Object.keys(r)).toStrictEqual(["s", "f", "r", "sj", "fj", "m", "mj"]);
  expect(hideLater(p, { files: [], imports: {} })).toStrictEqual(EX1);
  // two generations, a root-level package "." that a kept file imports, and a second card in a later generation
  const card = (id: string, targets: string[], dependsOn: string[]) => ({ ...p.cards[0], customId: id, targets, dependsOn });
  const p2: Plan = { ...p, cards: [card("a", ["x/a.go"], []), card("b", ["main.go", "b_test.go"], ["a"])], generations: [["a"], ["b"]], externalDependsOn: {} };
  const t2: GoTree = { files: ["b_test.go", "main.go", "tool/t.go", "x/a.go"], imports: { "b_test.go": [], "main.go": ["x"], "tool/t.go": ["."], "x/a.go": [] } };
  expect(hideLater(p2, t2)).toStrictEqual({ a: ["b_test.go"], b: [] });
  expect(hideLater(p2, { ...t2, imports: { ...t2.imports, "tool/t.go": [] } })).toStrictEqual({ a: ["main.go", "b_test.go"], b: [] });
});
