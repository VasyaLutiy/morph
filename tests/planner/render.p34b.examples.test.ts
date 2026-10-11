import { test, expect } from "vitest";
import { loadContour } from "../../src/contour/load.js";
import { dataBlocks, functionSection, interfaceSection } from "../../src/planner/render.js";
import { fixture, fixtureJson } from "../helpers.js";
import type { Component, ContourFunction } from "../../src/contour/types.js";

const R = loadContour(fixture("planner/events.yaml"), "events.yaml");
if (!R.ok) throw new Error(R.error);
const ORDERS = R.record.system.groups[0];
const T = fixtureJson("planner/events.texts.json") as Record<string, string | string[]>;

function fn(component: Component, name: string): ContourFunction {
  const found = component.functions.find((f) => f.name === name);
  if (found === undefined) throw new Error("no Function " + name);
  return found;
}

test("Render Function example 4: dataBlocks renders a Data block and the Event blocks of Place Order and Cancel Order", () => {
  const blocks = dataBlocks(R.record, [fn(ORDERS, "Place Order"), fn(ORDERS, "Cancel Order")]);
  expect(blocks).toStrictEqual(T["dataBlocks Place Order, Cancel Order"]);
});

test("Render Function example 5: functionSection of a Function with no examples omits the examples heading and the behaviour", () => {
  const priceCart = functionSection(R.record, fn(ORDERS, "Price Cart"));
  expect(priceCart).toBe(T["functionSection Price Cart"]);
  expect(priceCart).not.toContain("Examples (the tests must prove each one):");
  expect(priceCart).not.toContain("Behaviour:");
  const placeOrder = functionSection(R.record, fn(ORDERS, "Place Order"));
  expect(placeOrder).toBe(T["functionSection Place Order"]);
});

test("Render Context example 5: interfaceSection renders the schema, the requirements and the guardrails of orders API", () => {
  const iface = ORDERS.interfaces.find((i) => i.name === "orders API");
  if (iface === undefined) throw new Error("no Interface orders API");
  const modules = ["src/orders/placeOrder.ts", "src/orders/cancelOrder.ts"];
  expect(interfaceSection(iface, modules, R.record)).toBe(T["interfaceSection orders API"]);
  expect(interfaceSection(iface, modules)).toBe(T["interfaceSection orders API, no record"]);
});
