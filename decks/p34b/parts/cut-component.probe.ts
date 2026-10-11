// P34b probe for cut-component by docs/TASK_P34b_contour.md §2.2 (src/planner/types.ts, src/planner/cut.ts) — issue
// #44: the Interface contract in the card, the card's guardrail list for #42. Record Cut Component example 7;
// unchanged row: Cut Component 1 (ledger.cut.json).
import { test, expect } from "vitest";
import { cutComponent } from "../../src/planner/cut.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";
import type { Component, ContourMap, ContourRecord } from "../../src/contour/types.js";

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

test("Cut Component example 7: the cards of orders, their guardrails and the Interface contract", () => {
  const R = record("planner/events.yaml");
  const r = cutComponent({ record: R, component: R.system.groups[0] as Component, map: contourMap("planner/events.map.json"), docs: [], spec: "events.yaml" });
  if (!r.ok) throw new Error(r.error);
  expect(r.cuts.map((c) => c.card.customId)).toStrictEqual(["place-order", "price-cart", "cancel-order", "orders-api"]);
  expect(r.cuts.map((c) => c.guardrails)).toStrictEqual([["No Network"], ["No Network"], ["One Writer", "No Network"], ["One Writer", "Missing Rule", "No Network"]]);
  const T = fixtureJson("planner/events.texts.json") as Record<string, string>;
  expect(r.cuts[3].card.instruction).toContain(T["interfaceSection orders API"]);
});

test("unchanged: Cut Component example 1, the ledger cards", () => {
  const R = record("planner/ledger.yaml");
  const r = cutComponent({ record: R, component: R.system.groups[0] as Component, map: contourMap("planner/ledger.map.json"), docs: ["docs/TASK.md"], spec: "ledger.yaml" });
  if (!r.ok) throw new Error(r.error);
  expect(r.cuts.map((c) => c.card)).toStrictEqual(fixtureJson("planner/ledger.cut.json"));
});
