// P35a probe for plan-spec by docs/TASK_P35a_criterion.md §2.2 (src/planner/types.ts, src/planner/plan.ts) —
// issue #45: the plan's Card Criterion per card. New Plan Spec example 9 (go-mini, then the ledger's group,
// Interface card, extra card and its judge). Unchanged rows: the ledger plan, the go-mini card ids (green on the stub).
import { test, expect } from "vitest";
import { planSpec } from "../../src/planner/plan.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";
import type { ContourMap, ContourRecord } from "../../src/contour/types.js";
import type { PlanResult } from "../../src/planner/types.js";

function record(name: string): ContourRecord {
  const r = loadContour(fixture(name), name);
  if (!r.ok) throw new Error(r.error);
  return r.record;
}
function contourMap(name: string): ContourMap {
  const m = loadMap(fixture(name), name);
  if (!m.ok) throw new Error(m.error);
  return m.map;
}
const fnOf = (rec: ContourRecord, name: string) => {
  const f = rec.system.groups.flatMap((g) => g.functions).find((x) => x.name === name);
  if (f === undefined) throw new Error(name);
  return { name: f.name, examples: f.examples };
};
type Ok = Extract<PlanResult, { ok: true }>;
const crit = (r: Ok): Record<string, unknown> => (r as unknown as { criteria: Record<string, unknown> }).criteria;
const goMini = (): { rec: ContourRecord; r: Ok } => {
  const rec = record("go-mini/contour.yaml");
  const r = planSpec({ record: rec, map: contourMap("go-mini/morph-map.json"), spec: "contour.yaml", components: ["calc", "report"], judge: true, hasFile: () => false });
  if (!r.ok) throw new Error(r.error);
  return { rec, r };
};
const ledger = (): { rec: ContourRecord; r: Ok } => {
  const rec = record("planner/ledger.yaml");
  const r = planSpec({ record: rec, map: contourMap("planner/ledger.map.json"), spec: "ledger.yaml", components: ["ledger", "store"], judge: true, hasFile: (p) => p === "tests/helpers.ts" });
  if (!r.ok) throw new Error(r.error);
  return { rec, r };
};
const IDS = ["clamp-value", "clamp-value-judge", "percent-of", "format-share", "percent-of-judge", "format-share-judge"];

test("Plan Spec example 9: go-mini's criteria, a judge holds its code card's Functions", () => {
  const { rec, r } = goMini();
  const c = crit(r);
  expect(c).toBeDefined();
  expect(Object.keys(c).slice().sort()).toStrictEqual(IDS.slice().sort());
  expect(c["clamp-value"]).toStrictEqual({ judge: false, functions: [fnOf(rec, "Clamp Value")] });
  expect(c["clamp-value-judge"]).toStrictEqual({ judge: true, functions: [fnOf(rec, "Clamp Value")] });
  expect(c["percent-of"]).toStrictEqual({ judge: false, functions: [fnOf(rec, "Percent Of")] });
  expect(c["percent-of-judge"]).toStrictEqual({ judge: true, functions: [fnOf(rec, "Percent Of")] });
  expect(c["format-share"]).toStrictEqual({ judge: false, functions: [fnOf(rec, "Format Share")] });
  expect(c["format-share-judge"]).toStrictEqual({ judge: true, functions: [fnOf(rec, "Format Share")] });
  expect(fnOf(rec, "Percent Of").examples.length).toBe(5);
});

test("Plan Spec example 9: the ledger's group, Interface card, extra card and its judge", () => {
  const { rec, r } = ledger();
  const c = crit(r);
  expect(c).toBeDefined();
  expect(Object.keys(c)).toStrictEqual(r.plan.cards.map((k) => k.customId));
  expect(Object.keys(c).length).toBe(17);
  const group = { judge: false, functions: [fnOf(rec, "Sum Entries"), fnOf(rec, "Check Ledger")] };
  expect(c["checks"]).toStrictEqual(group);
  expect(c["checks-judge"]).toStrictEqual({ ...group, judge: true });
  expect(c["parse"]).toStrictEqual({ judge: false, functions: [fnOf(rec, "Parse Entry")] });
  expect(c["ledger-cli"]).toStrictEqual({ judge: false, functions: [] });
  expect(c["notes"]).toStrictEqual({ judge: false, functions: [] });
  expect(c["store-schema-judge"]).toStrictEqual({ judge: true, functions: [] });
});

test("Plan Spec unchanged: the ledger plan and go-mini's card ids", () => {
  expect(ledger().r.plan).toStrictEqual(fixtureJson("planner/ledger.plan.json"));
  expect(goMini().r.plan.cards.map((k) => k.customId)).toStrictEqual(IDS);
});
