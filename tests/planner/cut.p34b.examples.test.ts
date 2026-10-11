import { expect, test } from "vitest";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { cutComponent } from "../../src/planner/cut.js";
import { fixture, fixtureJson } from "../helpers.js";

test("Cut Component example 7: renders Events and the Interface contract with guardrails", () => {
  const R = loadContour(fixture("planner/events.yaml"), "events.yaml");
  if (!R.ok) throw new Error(R.error);
  const M = loadMap(fixture("planner/events.map.json"), "events.map.json");
  if (!M.ok) throw new Error(M.error);

  const ORDERS = R.record.system.groups[0];
  const T = fixtureJson("planner/events.texts.json") as Record<string, string | string[]>;

  const result = cutComponent({
    record: R.record,
    component: ORDERS,
    map: M.map,
    docs: [],
    spec: "events.yaml",
  });
  if (!result.ok) throw new Error(result.error);

  const cuts = result.cuts;
  expect(cuts.map((c) => c.card.customId)).toStrictEqual([
    "place-order",
    "price-cart",
    "cancel-order",
    "orders-api",
  ]);
  expect(cuts.map((c) => c.guardrails)).toStrictEqual([
    ["No Network"],
    ["No Network"],
    ["One Writer", "No Network"],
    ["One Writer", "Missing Rule", "No Network"],
  ]);

  const ordersApi = cuts.find((c) => c.card.customId === "orders-api");
  if (ordersApi === undefined) throw new Error("no orders-api Cut Card");
  expect(ordersApi.card.instruction).toContain(T["interfaceSection orders API"] as string);
});
