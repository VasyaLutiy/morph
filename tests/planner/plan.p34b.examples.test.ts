import { expect, test } from "vitest";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { planSpec } from "../../src/planner/plan.js";
import { fixture, fixtureJson } from "../helpers.js";

test("Plan Spec example 8: events fixtures produce the committed plan and warnings", () => {
  const R = loadContour(fixture("planner/events.yaml"), "events.yaml");
  if (!R.ok) throw new Error(R.error);
  const M = loadMap(fixture("planner/events.map.json"), "events.map.json");
  if (!M.ok) throw new Error(M.error);
  const r = planSpec({
    record: R.record,
    map: M.map,
    spec: "events.yaml",
    components: ["orders", "catalog"],
    judge: true,
    hasFile: (p) => p === "tests/helpers.ts",
  });
  if (!r.ok) throw new Error(r.error);
  expect(r.plan).toStrictEqual(fixtureJson("planner/events.plan.json"));
  expect(r.warnings).toStrictEqual(fixtureJson("planner/events.warnings.json"));
});

test("Plan Spec example 8: the ledger names two undefined step targets", () => {
  const R = loadContour(fixture("planner/ledger.yaml"), "ledger.yaml");
  if (!R.ok) throw new Error(R.error);
  const M = loadMap(fixture("planner/ledger.map.json"), "ledger.map.json");
  if (!M.ok) throw new Error(M.error);
  const r = planSpec({
    record: R.record,
    map: M.map,
    spec: "ledger.yaml",
    components: ["ledger", "store"],
    judge: true,
    hasFile: (p) => p === "tests/helpers.ts",
  });
  if (!r.ok) throw new Error(r.error);
  expect(r.plan).toStrictEqual(fixtureJson("planner/ledger.plan.json"));
  expect(r.warnings).toStrictEqual([
    "ledger/Sum Entries: step produces 'number' names no Data Object or Event of the record",
    "ledger/Format Report: step produces 'string' names no Data Object or Event of the record",
  ]);
});

test("Plan Spec example 8: this repository's own record warns about nothing", () => {
  const R = loadContour(fixture("../../contour.yaml"), "contour.yaml");
  if (!R.ok) throw new Error(R.error);
  const M = loadMap(fixture("../../morph-map.json"), "morph-map.json");
  if (!M.ok) throw new Error(M.error);
  const r = planSpec({
    record: R.record,
    map: M.map,
    spec: "contour.yaml",
    components: ["contour"],
    judge: true,
    hasFile: () => true,
  });
  if (!r.ok) throw new Error(r.error);
  expect(r.warnings).toStrictEqual([]);
});
