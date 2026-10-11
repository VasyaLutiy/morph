// P34b probe for render by docs/TASK_P34b_contour.md §2.2 (src/planner/render.ts) — issue #44: Events rendered like
// Data Objects, no empty Examples heading, the Interface contract. Record Render Function examples 4, 5 and Render
// Context example 5 (tests/fixtures/planner/examples.json); unchanged rows: Render Function 3 and Render Context 4.
import { test, expect } from "vitest";
import { dataBlocks, functionSection, interfaceSection } from "../../src/planner/render.js";
import { loadContour } from "../../src/contour/load.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";
import type { Component, ContourFunction, ContourRecord } from "../../src/contour/types.js";

function record(name: string): ContourRecord {
  const r = loadContour(fixture(name), name);
  if (!r.ok) throw new Error(r.error);
  return r.record;
}
const R = record("planner/events.yaml");
const ORDERS = R.system.groups[0] as Component;
const fn = (c: Component, n: string): ContourFunction => c.functions.find((f) => f.name === n) as ContourFunction;
const T = fixtureJson("planner/events.texts.json") as Record<string, string | string[]>;
const MODULES = ["src/orders/placeOrder.ts", "src/orders/cancelOrder.ts"];

test("Render Function example 4: Events of any Component render like Data Objects", () => {
  expect(dataBlocks(R, [fn(ORDERS, "Place Order"), fn(ORDERS, "Cancel Order")])).toStrictEqual(T["dataBlocks Place Order, Cancel Order"]);
});

test("Render Function example 5: a Function without behavior and examples has no Behaviour block and no Examples heading", () => {
  expect(functionSection(R, fn(ORDERS, "Price Cart"))).toBe(T["functionSection Price Cart"]);
});

test("Render Function example 5: Place Order's section carries its Event block", () => {
  expect(functionSection(R, fn(ORDERS, "Place Order"))).toBe(T["functionSection Place Order"]);
});

test("Render Context example 5: the Interface section carries schema, requirements and guardrails", () => {
  expect(interfaceSection(ORDERS.interfaces[0], MODULES, R)).toBe(T["interfaceSection orders API"]);
});

test("Render Context example 5: without the record every bound is not found", () => {
  expect(interfaceSection(ORDERS.interfaces[0], MODULES)).toBe(T["interfaceSection orders API, no record"]);
});

test("unchanged: Render Context example 4 on the ledger Interface", () => {
  const LEDGER = record("planner/ledger.yaml").system.groups[0] as Component;
  const iface = LEDGER.interfaces.find((i) => i.name === "ledger CLI");
  if (iface === undefined) throw new Error("interface ledger CLI not found");
  expect(interfaceSection(iface, ["src/a.ts", "src/b.ts"])).toBe(
    "## Interface ledger CLI\n\nThe command line.\n\nExposes:\n- Format Report (`src/a.ts`)\n- Check Ledger (`src/b.ts`)",
  );
});

test("unchanged: Render Function example 3, Data Objects of the ledger store", () => {
  const STORE = record("planner/ledger.yaml").system.groups[1] as Component;
  const L = record("planner/ledger.yaml");
  expect(dataBlocks(L, [fn(STORE, "Save Ledger"), fn(STORE, "Load Ledger")])).toStrictEqual([
    "Data Ledger File: A text file of entries.\nSchema:\n{\n  \"path\": \"string\",\n  \"text\": \"string\"\n}",
    "Data Entry: One ledger entry.\nSchema:\n{ name: string, cents: number }",
  ]);
});
