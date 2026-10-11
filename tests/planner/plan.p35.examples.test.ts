import { test, expect } from "vitest";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { planSpec } from "../../src/planner/plan.js";
import { fixture, fixtureJson } from "../helpers.js";

test("Plan Spec example 9: the Card Criterion of the go-mini plan and of the ledger plan", () => {
  const goRecord = loadContour(fixture("go-mini/contour.yaml"), "contour.yaml");
  if (!goRecord.ok) throw new Error(goRecord.error);
  const goMap = loadMap(fixture("go-mini/morph-map.json"), "morph-map.json");
  if (!goMap.ok) throw new Error(goMap.error);
  const go = planSpec({
    record: goRecord.record,
    map: goMap.map,
    spec: "contour.yaml",
    components: ["calc", "report"],
    judge: true,
    hasFile: () => false,
  });
  if (!go.ok) throw new Error(go.error);

  const goFn = (name: string) => {
    const f = goRecord.record.system.groups
      .flatMap((g) => g.functions)
      .find((x) => x.name === name);
    if (f === undefined) throw new Error(name);
    return { name: f.name, examples: f.examples };
  };

  expect(Object.keys(go.criteria)).toStrictEqual([
    "clamp-value",
    "clamp-value-judge",
    "percent-of",
    "format-share",
    "percent-of-judge",
    "format-share-judge",
  ]);
  expect(go.criteria["clamp-value"]).toStrictEqual({
    judge: false,
    functions: [goFn("Clamp Value")],
  });
  expect(go.criteria["clamp-value-judge"]).toStrictEqual({
    judge: true,
    functions: [goFn("Clamp Value")],
  });
  expect(go.criteria["percent-of"]).toStrictEqual({
    judge: false,
    functions: [goFn("Percent Of")],
  });
  expect(go.criteria["percent-of-judge"]).toStrictEqual({
    judge: true,
    functions: [goFn("Percent Of")],
  });
  expect(go.criteria["format-share"]).toStrictEqual({
    judge: false,
    functions: [goFn("Format Share")],
  });
  expect(go.criteria["format-share-judge"]).toStrictEqual({
    judge: true,
    functions: [goFn("Format Share")],
  });

  const ledgerRecord = loadContour(fixture("planner/ledger.yaml"), "ledger.yaml");
  if (!ledgerRecord.ok) throw new Error(ledgerRecord.error);
  const ledgerMap = loadMap(fixture("planner/ledger.map.json"), "ledger.map.json");
  if (!ledgerMap.ok) throw new Error(ledgerMap.error);
  const ledger = planSpec({
    record: ledgerRecord.record,
    map: ledgerMap.map,
    spec: "ledger.yaml",
    components: ["ledger", "store"],
    judge: true,
    hasFile: (path) => path === "tests/helpers.ts",
  });
  if (!ledger.ok) throw new Error(ledger.error);

  const ledgerFn = (name: string) => {
    const f = ledgerRecord.record.system.groups
      .flatMap((g) => g.functions)
      .find((x) => x.name === name);
    if (f === undefined) throw new Error(name);
    return { name: f.name, examples: f.examples };
  };

  expect(Object.keys(ledger.criteria)).toStrictEqual(
    ledger.plan.cards.map((c) => c.customId),
  );
  expect(ledger.criteria["checks"]).toStrictEqual({
    judge: false,
    functions: [ledgerFn("Sum Entries"), ledgerFn("Check Ledger")],
  });
  expect(ledger.criteria["checks-judge"]).toStrictEqual({
    judge: true,
    functions: [ledgerFn("Sum Entries"), ledgerFn("Check Ledger")],
  });
  expect(ledger.criteria["parse"]).toStrictEqual({
    judge: false,
    functions: [ledgerFn("Parse Entry")],
  });
  expect(ledger.criteria["ledger-cli"]).toStrictEqual({
    judge: false,
    functions: [],
  });
  expect(ledger.criteria["notes"]).toStrictEqual({
    judge: false,
    functions: [],
  });
  expect(ledger.criteria["store-schema-judge"]).toStrictEqual({
    judge: true,
    functions: [],
  });
  expect(ledger.plan).toStrictEqual(fixtureJson("planner/ledger.plan.json"));
});
