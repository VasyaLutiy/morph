// P34b probe for plan-spec by docs/TASK_P34b_contour.md §2.2 (src/planner/plan.ts) — issue #44: the plan's warnings
// for a step target naming no Data Object or Event and for a Function without examples. Record Plan Spec example 8;
// unchanged rows: the ledger and events plans themselves, the own record's warnings [] (green on the stub's []).
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
const helpersOnly = (p: string): boolean => p === "tests/helpers.ts";
const events = (): PlanResult => planSpec({ record: record("planner/events.yaml"), map: contourMap("planner/events.map.json"), spec: "events.yaml", components: ["orders", "catalog"], judge: true, hasFile: helpersOnly });
const ledger = (): PlanResult => planSpec({ record: record("planner/ledger.yaml"), map: contourMap("planner/ledger.map.json"), spec: "ledger.yaml", components: ["ledger", "store"], judge: true, hasFile: helpersOnly });

test("Plan Spec example 8: the events plan warns its 5 gaps", () => {
  const r = events();
  if (!r.ok) throw new Error(r.error);
  expect(r.warnings).toStrictEqual(fixtureJson("planner/events.warnings.json"));
});

test("Plan Spec example 8: the ledger plan warns its two value targets", () => {
  const r = ledger();
  if (!r.ok) throw new Error(r.error);
  expect(r.warnings).toStrictEqual([
    "ledger/Sum Entries: step produces 'number' names no Data Object or Event of the record",
    "ledger/Format Report: step produces 'string' names no Data Object or Event of the record",
  ]);
});

test("Plan Spec example 8: the events plan equals events.plan.json (needs render, cut-judges)", () => {
  const r = events();
  if (!r.ok) throw new Error(r.error);
  expect(r.plan).toStrictEqual(fixtureJson("planner/events.plan.json"));
});

test("unchanged: Plan Spec example 8, the ledger plan still equals ledger.plan.json", () => {
  const r = ledger();
  if (!r.ok) throw new Error(r.error);
  expect(r.plan).toStrictEqual(fixtureJson("planner/ledger.plan.json"));
});

test("unchanged: Plan Spec example 8, this repository's contour Component warns nothing", () => {
  const r = planSpec({ record: record("../../contour.yaml"), map: contourMap("../../morph-map.json"), spec: "contour.yaml", components: ["contour"], judge: true, hasFile: () => true });
  if (!r.ok) throw new Error(r.error);
  expect(r.warnings).toStrictEqual([]);
});
