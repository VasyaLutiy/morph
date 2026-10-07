// P10a probe for plan-spec: orderDeck, planSpec by docs/TASK_P10a_planner.md §2.2, one test per record example
// (Component planner: Order Deck 1-3, Plan Spec 1-5), then the §2.2 rows and the types. The harness is §2.1's,
// verbatim. Plan Spec 1 is the golden cross-check against the old mrph's own answer (ledger.golden.json).
import { test, expect, expectTypeOf } from "vitest";
import { orderDeck, planSpec } from "../../src/planner/plan.js";
import type { OrderResult, PlanInput, PlanResult } from "../../src/planner/types.js";
import type { Card } from "../../src/cards/types.js";
import { loadDeck } from "../../src/cards/model.js";
import type { Component, ContourMap, ContourRecord } from "../../src/contour/types.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

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
const REC = record("planner/ledger.yaml");
const MAP = contourMap("planner/ledger.map.json");
const card = (id: string, dependsOn: string[]): Card => ({ customId: id, intent: "patch", targets: ["src/" + id + ".ts"],
  contextSlice: [], instruction: "x", acceptance: null, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn });
const helpersOnly = (p: string): boolean => p === "tests/helpers.ts";
const input = (over: Partial<PlanInput>): PlanInput => ({ record: REC, map: MAP, spec: "ledger.yaml",
  components: ["ledger", "store"], judge: true, hasFile: helpersOnly, ...over });
const ids = (r: OrderResult | PlanResult): string[] =>
  r.ok ? ("plan" in r ? r.plan.cards : r.cards).map((c) => c.customId) : [r.error];
const err = (r: PlanResult): string => (r.ok ? "<ok>" : r.error);

test("Order Deck example 1: the layered fixture in reverse order", () => {
  const d = loadDeck(fixture("decks/layered.json"));
  if (!d.ok) throw new Error("layered.json does not load");
  const r = orderDeck([...d.deck.cards].reverse());
  expect(ids(r)).toStrictEqual(["a", "b", "c", "d"]);
  expect(r.ok ? r.generations : r.error).toStrictEqual([["a"], ["b", "c"], ["d"]]);
  expect(r.ok ? r.externalDependsOn : r.error).toStrictEqual({});
});

test("Order Deck example 2: external ids count as done", () => {
  const r = orderDeck([card("z", ["y", "ext"]), card("y", []), card("x", ["ext2", "y"])]);
  expect(ids(r)).toStrictEqual(["y", "x", "z"]);
  expect(r.ok ? r.generations : r.error).toStrictEqual([["y"], ["x", "z"]]);
  expect(r.ok ? JSON.stringify(r.externalDependsOn) : r.error).toBe('{"x":["ext2"],"z":["ext"]}');
});

test("Order Deck example 3: a cycle", () => {
  expect(orderDeck([card("a", ["b"]), card("b", ["a"]), card("c", [])])).toStrictEqual({ ok: false, error: "dependency cycle among a, b" });
});

test("Plan Spec example 1: the golden cross-check and the whole plan", () => {
  const r = planSpec(input({}));
  const golden = fixtureJson("planner/ledger.golden.json") as {
    cards: { customId: string; dependsOn: string[] }[]; generations: string[][]; externalDependsOn: Record<string, string[]> };
  expect(r.ok ? r.plan.cards.map((c) => ({ customId: c.customId, dependsOn: c.dependsOn })) : r.error).toStrictEqual(golden.cards);
  expect(r.ok ? r.plan.generations : r.error).toStrictEqual(golden.generations);
  expect(r.ok ? r.plan.externalDependsOn : r.error).toStrictEqual(golden.externalDependsOn);
  expect(r.ok ? r.plan : r.error).toStrictEqual(fixtureJson("planner/ledger.plan.json"));
  expect(r.ok ? r.plan.cards.some((c) => c.contextSlice.includes("ledger.yaml")) : r.error).toBe(false);
});

test("Plan Spec example 2: one Component, no judges, extras by Component", () => {
  const r = planSpec(input({ components: ["store"], judge: false }));
  expect(ids(r)).toStrictEqual(["load-ledger", "notes", "save-ledger", "store-schema"]);
  expect(r.ok ? r.plan.generations : r.error).toStrictEqual([["load-ledger", "notes", "save-ledger", "store-schema"]]);
  expect(r.ok ? r.plan.externalDependsOn : r.error).toStrictEqual({ notes: ["parse"], "save-ledger": ["format-report"] });
  expect(r.ok ? r.plan.cards.find((c) => c.customId === "save-ledger")?.contextSlice : r.error).toStrictEqual(["docs/TASK.md"]);
  expect(r.ok ? r.plan.components : r.error).toStrictEqual(["store"]);
});

test("Plan Spec example 3: the record never rides in a slice", () => {
  const map: ContourMap = { ...MAP, cards: MAP.cards.map((c) => (c.id === "parse-entry" ? { ...c, contextSlice: ["ledger.yaml", "docs/A.md"] } : c)) };
  const r = planSpec(input({ map, components: ["ledger"], judge: false }));
  expect(r.ok ? r.plan.cards.find((c) => c.customId === "parse")?.contextSlice : r.error).toStrictEqual(["docs/A.md"]);
});

test("Plan Spec example 4: the faults", () => {
  expect(err(planSpec(input({ map: { ...MAP, language: "cobol" } })))).toBe("the map: unknown language 'cobol' (known: typescript, python)");
  expect(err(planSpec(input({ components: ["nope"] })))).toBe("no Component 'nope' in the record (have: ledger, store)");
  const nowhere = MAP.extraCards.map((e) => (e.customId === "store-schema" ? { ...e, component: "Nowhere" } : e));
  expect(err(planSpec(input({ map: { ...MAP, extraCards: nowhere } }))))
    .toBe("extra card 'store-schema' names Component 'Nowhere' the record does not have (have: ledger, store)");
  const dup = MAP.extraCards.map((e) => (e.customId === "ledger-types" ? { ...e, customId: "parse" } : e));
  expect(err(planSpec(input({ map: { ...MAP, extraCards: dup } })))).toBe("duplicate customId 'parse'");
  const cyc = MAP.cards.map((c) => (c.id === "parse-entry" ? { ...c, dependsOn: ["checks"] } : c));
  expect(err(planSpec(input({ map: { ...MAP, cards: cyc }, components: ["ledger"], judge: false }))))
    .toBe("dependency cycle among checks, format-report, ledger-cli, notes, parse");
});

test("Plan Spec example 5: this repository's own record, Component contour", () => {
  const rec = record("../../contour.yaml");
  const map = contourMap("../../morph-map.json");
  const r = planSpec({ record: rec, map, spec: "contour.yaml", components: ["contour"], judge: true, hasFile: () => true });
  expect(r.ok ? r.plan.generations : r.error).toStrictEqual([["validate-record"], ["select-components", "validate-map", "validate-record-judge"],
    ["load-spec", "select-components-judge", "validate-map-judge"], ["load-spec-judge"]]);
  expect(r.ok ? r.plan.cards.every((c) => c.acceptance === map.cards.find((m) => m.id === c.customId)?.acceptance) : r.error).toBe(true);
  expect(r.ok ? r.plan.cards.some((c) => c.contextSlice.includes("contour.yaml")) : r.error).toBe(false);
});

test("§2.2: the cross-cut slice, a default-language map, extras as cards", () => {
  const r = planSpec(input({}));
  const save = r.ok ? r.plan.cards.find((c) => c.customId === "save-ledger") : undefined;
  expect(save?.contextSlice).toStrictEqual(["docs/TASK.md", "src/ledger/formatReport.ts"]);
  const types = r.ok ? r.plan.cards.find((c) => c.customId === "ledger-types") : undefined;
  expect(types).toStrictEqual({ customId: "ledger-types", intent: "patch", targets: ["src/ledger/types.ts"], contextSlice: [],
    instruction: "Write the types.", acceptance: "exit 0\n", model: null, maxTokens: null, reasoning: { maxTokens: 1000 }, variants: 1, dependsOn: [] });
  const bare = planSpec(input({ map: { ...MAP, language: null }, components: ["ledger"], judge: false }));
  expect(bare.ok).toBe(true);
  const one = planSpec(input({ record: { ...REC, system: { ...REC.system, groups: [REC.system.groups[0] as Component] } }, map: { ...MAP, extraCards: [] }, components: [], judge: false }));
  expect(one.ok ? one.plan.components : one.error).toStrictEqual(["ledger"]);
});

test("§2.2: the types", () => {
  expectTypeOf(planSpec).parameters.toEqualTypeOf<[PlanInput]>();
  expectTypeOf(orderDeck).returns.toEqualTypeOf<OrderResult>();
  expectTypeOf<PlanInput>().toEqualTypeOf<{
    record: ContourRecord; map: ContourMap; spec: string; components: string[]; judge: boolean; hasFile: (path: string) => boolean;
  }>();
  expectTypeOf<OrderResult>().toEqualTypeOf<
    | { ok: true; cards: Card[]; generations: string[][]; externalDependsOn: Record<string, string[]> }
    | { ok: false; error: string }>();
});
