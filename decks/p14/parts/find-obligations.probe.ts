// P14a probe for find-obligations by docs/TASK_P14_reviewer.md §2.2 (Find Obligations) — the Functions of the record a
// range touches (by the range's Morph-Card values and by the changed paths against each unit's targets: a map group, a map
// card's targets, language's cut), each with the example titles its tests at head must hold, by the profile's naming.
// Record Find Obligations examples 1-4, then the §2.2 rows. The record and map are tests/fixtures/reviewer/{record.yaml,map.json}.
import { test, expect } from "vitest";
import { cardUnit, exampleTitle, findObligations, hasTitle } from "../../src/reviewer/findObligations.js";
import type { Obligation, ObligationResult } from "../../src/reviewer/findObligations.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { PYTHON, TYPESCRIPT } from "../../src/language/profiles.js";
import type { ContourMap, ContourRecord } from "../../src/contour/types.js";
import { fixture } from "../../tests/helpers.js";

function inputs(): { record: ContourRecord; map: ContourMap } {
  const r = loadContour(fixture("reviewer/record.yaml"), "record.yaml");
  const m = loadMap(fixture("reviewer/map.json"), "map.json");
  if (!r.ok || !m.ok) throw new Error("the reviewer fixtures do not load");
  return { record: r.record, map: m.map };
}
const finding = (component: string, fn: string, n: number, path: string, wanted: string) => ({
  kind: "obligation", source: `record: ${component} · ${fn} · example ${n}`, path,
  expected: `a test named "${wanted}"`, got: "no test title at head starts with it",
});

test("Find Obligations example 1: a changed code file touches Add Tax; example 2 has no title (10 is not 1)", () => {
  const got = findObligations({ ...inputs(), changed: ["src/shop/addTax.ts", "README.md"], cards: [],
    titles: ["Add Tax example 1: the tax", "Add Tax example 3: negative", "Add Tax example 10: other"] });
  const want: ObligationResult = {
    obligations: [{ component: "shop", function: "Add Tax", unit: "add-tax", touchedBy: ["file src/shop/addTax.ts"], examples: 3,
      judge: "tests/shop/addTax.examples.test.ts", missing: [2] }],
    findings: [finding("shop", "Add Tax", 2, "tests/shop/addTax.examples.test.ts", "Add Tax example 2")],
  };
  expect(got).toStrictEqual(want);
});

test("Find Obligations example 2: cards with a retry suffix, a map card's targets and a map group", () => {
  const got = findObligations({ ...inputs(), changed: ["tests/shop/round.examples.test.ts"],
    cards: ["round-price.r2", "price-text-judge", "round-price-judge"],
    titles: ["Round Price example 1: half up", "Round Price example 2", "Format Price example 1: dollars",
      "Parse Price example 1: dollars", "Parse Price example 2x"] });
  const want: Obligation[] = [
    { component: "shop", function: "Round Price", unit: "round-price",
      touchedBy: ["card round-price", "card round-price-judge", "file tests/shop/round.examples.test.ts"], examples: 2,
      judge: "tests/shop/round.examples.test.ts", missing: [] },
    { component: "shop", function: "Format Price", unit: "price-text", touchedBy: ["card price-text-judge"], examples: 1,
      judge: "tests/shop/priceText.examples.test.ts", missing: [] },
    { component: "shop", function: "Parse Price", unit: "price-text", touchedBy: ["card price-text-judge"], examples: 2,
      judge: "tests/shop/priceText.examples.test.ts", missing: [2] },
  ];
  expect(got).toStrictEqual({ obligations: want,
    findings: [finding("shop", "Parse Price", 2, "tests/shop/priceText.examples.test.ts", "Parse Price example 2")] });
});

test("Find Obligations example 3: a python Component — test_<snake>_example_<n>, the separator _", () => {
  const ob: Obligation = { component: "Ledger Tools", function: "Sum Rows", unit: "sum-rows",
    touchedBy: ["file ledger_tools/sum_rows.py"], examples: 2, judge: "tests/test_sum_rows_examples.py", missing: [] };
  expect(findObligations({ ...inputs(), changed: ["ledger_tools/sum_rows.py"], cards: [],
    titles: ["test_sum_rows_example_1", "test_sum_rows_example_2_empty", "Sum Rows example 1: no"] }))
    .toStrictEqual({ obligations: [ob], findings: [] });
  expect(findObligations({ ...inputs(), changed: ["ledger_tools/sum_rows.py"], cards: [], titles: ["test_sum_rows_example_12"] }))
    .toStrictEqual({ obligations: [{ ...ob, missing: [1, 2] }], findings: [
      finding("Ledger Tools", "Sum Rows", 1, "tests/test_sum_rows_examples.py", "test_sum_rows_example_1"),
      finding("Ledger Tools", "Sum Rows", 2, "tests/test_sum_rows_examples.py", "test_sum_rows_example_2")] });
});

test("Find Obligations example 4: an unknown language skips its Component; nothing touched; the helpers", () => {
  const got = findObligations({ ...inputs(), changed: ["legacy/oldTotal.ts", "tests/shop/addTax.test.ts"],
    cards: ["old-total", "add-tax-judge.r11"], titles: ["Add Tax example 1", "Add Tax example 2: x", "Add Tax example 3: y"] });
  expect(got).toStrictEqual({ obligations: [{ component: "shop", function: "Add Tax", unit: "add-tax",
    touchedBy: ["card add-tax-judge", "file tests/shop/addTax.test.ts"], examples: 3,
    judge: "tests/shop/addTax.examples.test.ts", missing: [] }], findings: [] });
  expect(findObligations({ ...inputs(), changed: [], cards: [], titles: [] })).toStrictEqual({ obligations: [], findings: [] });
  expect(exampleTitle(TYPESCRIPT, "Add Tax", 1)).toBe("Add Tax example 1");
  expect(exampleTitle(PYTHON, "Add Tax", 3)).toBe("test_add_tax_example_3");
  expect(hasTitle(["Add Tax example 1"], "Add Tax example 1", TYPESCRIPT)).toBe(true);
  expect(hasTitle(["Add Tax example 12"], "Add Tax example 1", TYPESCRIPT)).toBe(false);
  expect(cardUnit("a.r3")).toBe("a");
  expect(cardUnit("a.rx")).toBe("a.rx");
});

test("§2.2 rows: a card touches once though named twice; map.language reaches a Component without one; the judge override", () => {
  const { record, map } = inputs();
  const shop = record.system.groups[0];
  const bare: ContourRecord = { ...record, system: { ...record.system, groups: [{ ...shop, language: null }] } };
  const pyMap: ContourMap = { ...map, language: "python",
    cards: [...map.cards, { ...map.cards[1], id: "add-tax-judge", targets: ["tests/x/taxes.py"] }] };
  const got = findObligations({ record: bare, map: pyMap, changed: ["shop/add_tax.py", "tests/x/taxes.py"],
    cards: ["add-tax", "add-tax.r1", "add-tax.r2"], titles: ["test_add_tax_example_1", "test_add_tax_example_3_neg"] });
  expect(got).toStrictEqual({ obligations: [{ component: "shop", function: "Add Tax", unit: "add-tax",
    touchedBy: ["card add-tax", "file shop/add_tax.py", "file tests/x/taxes.py"], examples: 3, judge: "tests/x/taxes.py",
    missing: [2] }], findings: [finding("shop", "Add Tax", 2, "tests/x/taxes.py", "test_add_tax_example_2")] });
  expect(hasTitle(["Add Tax example 1: a"], "Add Tax example 1", PYTHON)).toBe(false);
  expect(hasTitle(["test_a_example_1_b"], "test_a_example_1", PYTHON)).toBe(true);
});

test("§2.2 rows: cardUnit only strips a final .r<digits>; the first map group wins; an unknown language does not stop the walk", () => {
  expect([cardUnit("a.r"), cardUnit("x.r1.y"), cardUnit("b.r12")]).toStrictEqual(["a.r", "x.r1.y", "b"]);
  const { record, map } = inputs();
  const [shop, ledger, legacy] = record.system.groups;
  const reordered: ContourRecord = { ...record, system: { ...record.system, groups: [legacy, shop, ledger] } };
  const twoGroups: ContourMap = { ...map, groups: [{ name: "taxes", functions: ["Add Tax"] }, { name: "later", functions: ["Add Tax"] }] };
  const got = findObligations({ record: reordered, map: twoGroups, changed: [], cards: ["taxes", "later", "old-total"], titles: [] });
  expect(got.obligations.map((o) => [o.function, o.unit, o.touchedBy, o.judge])).toStrictEqual([
    ["Add Tax", "taxes", ["card taxes"], "tests/shop/taxes.examples.test.ts"]]);
  expect(got.findings.length).toBe(3);
});
