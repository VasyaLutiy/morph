import { expect, test } from "vitest";
import { hideLater, type GoTree } from "../../src/planner/hideLater.js";
import { fixtureJson } from "../helpers.js";
import type { Plan } from "../../src/planner/types.js";

const plan = (): Plan => fixtureJson("planner/hide.plan.json") as Plan;
const tree = (): GoTree => fixtureJson("planner/hide.tree.json") as GoTree;

function plus(t: GoTree, file: string, imports: string[]): GoTree {
  return { files: [...t.files, file].sort(), imports: { ...t.imports, [file]: imports } };
}

test("Hide Later example 1: the later targets hidden, a package's non-test files kept", () => {
  expect(hideLater(plan(), tree())).toStrictEqual({
    s: [
      "report/format_line.go",
      "calc/ratio_of.go",
      "calc/scale_value_examples_test.go",
      "report/format_line_examples_test.go",
      "summary/summary.go",
      "summary/summary_examples_test.go",
    ],
    f: [
      "calc/ratio_of.go",
      "calc/scale_value_examples_test.go",
      "report/format_line_examples_test.go",
      "summary/summary.go",
      "summary/summary_examples_test.go",
    ],
    r: [
      "report/format_line.go",
      "calc/scale_value_examples_test.go",
      "report/format_line_examples_test.go",
      "summary/summary.go",
      "summary/summary_examples_test.go",
    ],
    sj: [
      "report/format_line.go",
      "calc/ratio_of.go",
      "report/format_line_examples_test.go",
      "summary/summary.go",
      "summary/summary_examples_test.go",
    ],
    fj: ["summary/summary.go", "summary/summary_examples_test.go"],
    m: ["report/format_line_examples_test.go", "summary/summary_examples_test.go"],
    mj: [],
  });
});

test("Hide Later example 2: a visible importer keeps summary.go, then report/format_line.go", () => {
  expect(hideLater(plan(), plus(tree(), "cmd/tool/main.go", ["summary"]))).toStrictEqual({
    s: [
      "calc/ratio_of.go",
      "calc/scale_value_examples_test.go",
      "report/format_line_examples_test.go",
      "summary/summary_examples_test.go",
    ],
    f: [
      "calc/ratio_of.go",
      "calc/scale_value_examples_test.go",
      "report/format_line_examples_test.go",
      "summary/summary_examples_test.go",
    ],
    r: [
      "calc/scale_value_examples_test.go",
      "report/format_line_examples_test.go",
      "summary/summary_examples_test.go",
    ],
    sj: [
      "calc/ratio_of.go",
      "report/format_line_examples_test.go",
      "summary/summary_examples_test.go",
    ],
    fj: ["summary/summary_examples_test.go"],
    m: ["report/format_line_examples_test.go", "summary/summary_examples_test.go"],
    mj: [],
  });
});

test("Hide Later example 3: a kept test file keeps summary.go, then report/format_line.go", () => {
  expect(hideLater(plan(), plus(tree(), "summary/legacy_test.go", []))).toStrictEqual({
    s: [
      "calc/ratio_of.go",
      "calc/scale_value_examples_test.go",
      "report/format_line_examples_test.go",
      "summary/summary_examples_test.go",
    ],
    f: [
      "calc/ratio_of.go",
      "calc/scale_value_examples_test.go",
      "report/format_line_examples_test.go",
      "summary/summary_examples_test.go",
    ],
    r: [
      "calc/scale_value_examples_test.go",
      "report/format_line_examples_test.go",
      "summary/summary_examples_test.go",
    ],
    sj: [
      "calc/ratio_of.go",
      "report/format_line_examples_test.go",
      "summary/summary_examples_test.go",
    ],
    fj: ["summary/summary_examples_test.go"],
    m: ["report/format_line_examples_test.go", "summary/summary_examples_test.go"],
    mj: [],
  });
});

test("Hide Later example 4: one generation gives {}, a missing summary.go keeps example 1", () => {
  const cut = plan();
  const onlyS: Plan = {
    ...cut,
    cards: cut.cards.filter((c) => c.customId === "s"),
    generations: [["s"]],
  };
  expect(hideLater(onlyS, tree())).toStrictEqual({});

  const full = tree();
  const files = full.files.filter((f) => f !== "summary/summary.go");
  const imports: Record<string, string[]> = {};
  for (const [file, list] of Object.entries(full.imports)) {
    if (file !== "summary/summary.go") imports[file] = list;
  }
  const withoutSummary = plus({ files, imports }, "cmd/tool/main.go", ["summary"]);
  expect(hideLater(plan(), withoutSummary)).toStrictEqual({
    s: [
      "report/format_line.go",
      "calc/ratio_of.go",
      "calc/scale_value_examples_test.go",
      "report/format_line_examples_test.go",
      "summary/summary.go",
      "summary/summary_examples_test.go",
    ],
    f: [
      "calc/ratio_of.go",
      "calc/scale_value_examples_test.go",
      "report/format_line_examples_test.go",
      "summary/summary.go",
      "summary/summary_examples_test.go",
    ],
    r: [
      "report/format_line.go",
      "calc/scale_value_examples_test.go",
      "report/format_line_examples_test.go",
      "summary/summary.go",
      "summary/summary_examples_test.go",
    ],
    sj: [
      "report/format_line.go",
      "calc/ratio_of.go",
      "report/format_line_examples_test.go",
      "summary/summary.go",
      "summary/summary_examples_test.go",
    ],
    fj: ["summary/summary.go", "summary/summary_examples_test.go"],
    m: ["report/format_line_examples_test.go", "summary/summary_examples_test.go"],
    mj: [],
  });
});

test("Hide Later leaves the plan and the tree unchanged", () => {
  const p = plan();
  const t = tree();
  const pBefore: unknown = JSON.parse(JSON.stringify(p));
  const tBefore: unknown = JSON.parse(JSON.stringify(t));
  hideLater(p, t);
  expect(p).toStrictEqual(pBefore);
  expect(t).toStrictEqual(tBefore);
});

test("Hide Later hides no card's own targets", () => {
  const p = plan();
  const result = hideLater(p, tree());
  for (const card of p.cards) {
    for (const target of card.targets) {
      expect(result[card.customId]).not.toContain(target);
    }
  }
});

test("Hide Later hides no target that is not a Go file", () => {
  const result = hideLater(plan(), tree());
  for (const list of Object.values(result)) {
    for (const file of list) expect(file.endsWith(".go")).toBe(true);
  }
});

test("Hide Later returns an entry for every card, empty lists included", () => {
  const p = plan();
  const result = hideLater(p, tree());
  const ids = p.cards.map((c) => c.customId);
  expect(Object.keys(result).sort()).toStrictEqual([...ids].sort());
  expect(result.mj).toStrictEqual([]);
});

test("Hide Later leaves a kept package's test files hidden", () => {
  const result = hideLater(plan(), plus(tree(), "cmd/tool/main.go", ["summary"]));
  expect(result.s).not.toContain("summary/summary.go");
  expect(result.s).toContain("summary/summary_examples_test.go");
  expect(result.s).toContain("report/format_line_examples_test.go");
});

test("Hide Later keeps a package reached through a kept file, to a fixed point", () => {
  const result = hideLater(plan(), plus(tree(), "cmd/tool/main.go", ["summary"]));
  expect(result.r).not.toContain("report/format_line.go");
  expect(result.r).not.toContain("summary/summary.go");
  expect(result.r).toContain("calc/scale_value_examples_test.go");
});
