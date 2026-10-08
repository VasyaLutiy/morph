import { describe, expect, test } from "vitest";

import { loadContour, loadMap } from "../../src/contour/load.js";
import type { ContourMap, ContourRecord } from "../../src/contour/types.js";
import { PYTHON, TYPESCRIPT } from "../../src/language/profiles.js";
import {
  cardUnit,
  exampleTitle,
  findObligations,
  hasTitle,
} from "../../src/reviewer/findObligations.js";
import { fixture } from "../helpers.js";

function loadRecord(): ContourRecord {
  const loaded = loadContour(fixture("reviewer/record.yaml"), "record.yaml");
  if (!loaded.ok) throw new Error(loaded.error);
  return loaded.record;
}

function loadMapFixture(): ContourMap {
  const loaded = loadMap(fixture("reviewer/map.json"), "map.json");
  if (!loaded.ok) throw new Error(loaded.error);
  return loaded.map;
}

describe("Find Obligations", () => {
  test("Find Obligations example 1: one touched Function misses its second example", () => {
    const result = findObligations({
      record: loadRecord(),
      map: loadMapFixture(),
      changed: ["src/shop/addTax.ts", "README.md"],
      cards: [],
      titles: [
        "Add Tax example 1: the tax",
        "Add Tax example 3: negative",
        "Add Tax example 10: other",
      ],
    });
    expect(result).toStrictEqual({
      obligations: [
        {
          component: "shop",
          function: "Add Tax",
          unit: "add-tax",
          touchedBy: ["file src/shop/addTax.ts"],
          examples: 3,
          judge: "tests/shop/addTax.examples.test.ts",
          missing: [2],
        },
      ],
      findings: [
        {
          kind: "obligation",
          source: "record: shop · Add Tax · example 2",
          path: "tests/shop/addTax.examples.test.ts",
          expected: 'a test named "Add Tax example 2"',
          got: "no test title at head starts with it",
        },
      ],
    });
  });

  test("Find Obligations example 2: the group's unit, the cards and the judge paths", () => {
    const result = findObligations({
      record: loadRecord(),
      map: loadMapFixture(),
      changed: ["tests/shop/round.examples.test.ts"],
      cards: ["round-price.r2", "price-text-judge", "round-price-judge"],
      titles: [
        "Round Price example 1: half up",
        "Round Price example 2",
        "Format Price example 1: dollars",
        "Parse Price example 1: dollars",
        "Parse Price example 2x",
      ],
    });
    expect(result).toStrictEqual({
      obligations: [
        {
          component: "shop",
          function: "Round Price",
          unit: "round-price",
          touchedBy: [
            "card round-price",
            "card round-price-judge",
            "file tests/shop/round.examples.test.ts",
          ],
          examples: 2,
          judge: "tests/shop/round.examples.test.ts",
          missing: [],
        },
        {
          component: "shop",
          function: "Format Price",
          unit: "price-text",
          touchedBy: ["card price-text-judge"],
          examples: 1,
          judge: "tests/shop/priceText.examples.test.ts",
          missing: [],
        },
        {
          component: "shop",
          function: "Parse Price",
          unit: "price-text",
          touchedBy: ["card price-text-judge"],
          examples: 2,
          judge: "tests/shop/priceText.examples.test.ts",
          missing: [2],
        },
      ],
      findings: [
        {
          kind: "obligation",
          source: "record: shop · Parse Price · example 2",
          path: "tests/shop/priceText.examples.test.ts",
          expected: 'a test named "Parse Price example 2"',
          got: "no test title at head starts with it",
        },
      ],
    });
  });

  test("Find Obligations example 3: the python example names and the judge path", () => {
    const record = loadRecord();
    const map = loadMapFixture();
    const named = findObligations({
      record,
      map,
      changed: ["ledger_tools/sum_rows.py"],
      cards: [],
      titles: [
        "test_sum_rows_example_1",
        "test_sum_rows_example_2_empty",
        "Sum Rows example 1: no",
      ],
    });
    expect(named).toStrictEqual({
      obligations: [
        {
          component: "Ledger Tools",
          function: "Sum Rows",
          unit: "sum-rows",
          touchedBy: ["file ledger_tools/sum_rows.py"],
          examples: 2,
          judge: "tests/test_sum_rows_examples.py",
          missing: [],
        },
      ],
      findings: [],
    });
    const loose = findObligations({
      record,
      map,
      changed: ["ledger_tools/sum_rows.py"],
      cards: [],
      titles: ["test_sum_rows_example_12"],
    });
    expect(loose).toStrictEqual({
      obligations: [
        {
          component: "Ledger Tools",
          function: "Sum Rows",
          unit: "sum-rows",
          touchedBy: ["file ledger_tools/sum_rows.py"],
          examples: 2,
          judge: "tests/test_sum_rows_examples.py",
          missing: [1, 2],
        },
      ],
      findings: [
        {
          kind: "obligation",
          source: "record: Ledger Tools · Sum Rows · example 1",
          path: "tests/test_sum_rows_examples.py",
          expected: 'a test named "test_sum_rows_example_1"',
          got: "no test title at head starts with it",
        },
        {
          kind: "obligation",
          source: "record: Ledger Tools · Sum Rows · example 2",
          path: "tests/test_sum_rows_examples.py",
          expected: 'a test named "test_sum_rows_example_2"',
          got: "no test title at head starts with it",
        },
      ],
    });
  });

  test("Find Obligations example 4: the unknown language skipped and the helpers alone", () => {
    const record = loadRecord();
    const map = loadMapFixture();
    const touched = findObligations({
      record,
      map,
      changed: ["legacy/oldTotal.ts", "tests/shop/addTax.test.ts"],
      cards: ["old-total", "add-tax-judge.r11"],
      titles: ["Add Tax example 1", "Add Tax example 2: tax", "Add Tax example 3"],
    });
    expect(touched).toStrictEqual({
      obligations: [
        {
          component: "shop",
          function: "Add Tax",
          unit: "add-tax",
          touchedBy: ["card add-tax-judge", "file tests/shop/addTax.test.ts"],
          examples: 3,
          judge: "tests/shop/addTax.examples.test.ts",
          missing: [],
        },
      ],
      findings: [],
    });
    expect(findObligations({ record, map, changed: [], cards: [], titles: [] })).toStrictEqual({
      obligations: [],
      findings: [],
    });
    expect(exampleTitle(TYPESCRIPT, "Add Tax", 1)).toBe("Add Tax example 1");
    expect(exampleTitle(PYTHON, "Add Tax", 3)).toBe("test_add_tax_example_3");
    expect(hasTitle(["Add Tax example 1"], "Add Tax example 1", TYPESCRIPT)).toBe(true);
    expect(hasTitle(["Add Tax example 12"], "Add Tax example 1", TYPESCRIPT)).toBe(false);
    expect(cardUnit("a.r3")).toBe("a");
    expect(cardUnit("a.rx")).toBe("a.rx");
  });
});
