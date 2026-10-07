// P10a probe for cut-component: cutUnits, cutComponent by docs/TASK_P10a_planner.md §2.2, one test per record
// example (Component planner: Cut Units 1-3, Cut Component 1-4), then the §2.2 rows and the types. The harness
// is §2.1's, verbatim.
import { test, expect, expectTypeOf } from "vitest";
import { cutComponent, cutUnits } from "../../src/planner/cut.js";
import type { CutInput, CutResult, UnitsResult } from "../../src/planner/types.js";
import type { Card } from "../../src/cards/types.js";
import type { Component, ContourFunction, ContourMap, ContourRecord, MapGroup } from "../../src/contour/types.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { PYTHON, TYPESCRIPT } from "../../src/language/profiles.js";
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
const LEDGER = REC.system.groups[0] as Component;
const STORE = REC.system.groups[1] as Component;
const EMPTY_MAP: ContourMap = { version: 1, package: null, language: null, docs: [], groups: [], cards: [], extraCards: [] };
const F = LEDGER.functions;
const cards = (r: CutResult): Card[] => (r.ok ? r.cuts.map((c) => c.card) : []);
const err = (r: CutResult | UnitsResult): string => (r.ok ? "<ok>" : r.error);

test("Cut Units example 1: Functions and a group in record order", () => {
  expect(cutUnits(LEDGER, [{ name: "checks", functions: ["Sum Entries", "Check Ledger"] }])).toStrictEqual({ ok: true, units: [
    { id: "parse-entry", name: "Parse Entry", functions: [F[0]], isGroup: false },
    { id: "checks", name: "checks", functions: [F[1], F[2]], isGroup: true },
    { id: "format-report", name: "Format Report", functions: [F[3]], isGroup: false }] });
  const r = cutUnits(LEDGER, [{ name: "checks", functions: ["Sum Entries", "Check Ledger"] }]);
  expect(r.ok ? r.units[1]?.functions[0] : null).toBe(F[1]);
});

test("Cut Units example 2: a group slugged, its Functions in record order, another Component's group skipped", () => {
  const r = cutUnits(LEDGER, [{ name: "Other", functions: ["Count Words"] }, { name: "Mixed Up", functions: ["Check Ledger", "Sum Entries"] }]);
  expect(r.ok ? r.units.map((u) => u.id) : r.error).toStrictEqual(["parse-entry", "mixed-up", "format-report"]);
  expect(r.ok ? r.units[1]?.functions.map((f) => f.name) : r.error).toStrictEqual(["Sum Entries", "Check Ledger"]);
  expect(r.ok ? r.units[1]?.name : r.error).toBe("Mixed Up");
});

test("Cut Units example 3: a group straddling two Components", () => {
  expect(cutUnits(LEDGER, [{ name: "bad", functions: ["Parse Entry", "Nope"] }])).toStrictEqual({ ok: false,
    error: "group 'bad' names unknown Function 'Nope' next to 'Parse Entry' of Component 'ledger': a group names the Functions of one Component" });
});

test("Cut Component example 1: Component ledger with the map", () => {
  const r = cutComponent({ record: REC, component: LEDGER, map: MAP, docs: ["docs/TASK.md"], spec: "ledger.yaml" });
  expect(cards(r)).toStrictEqual(fixtureJson("planner/ledger.cut.json"));
  expect(r.ok ? r.cuts.map((c) => c.functions.map((f) => f.name)) : r.error)
    .toStrictEqual([["Parse Entry"], ["Sum Entries", "Check Ledger"], ["Format Report"], []]);
  expect(r.ok ? r.cuts.map((c) => c.slicedByMap) : r.error).toStrictEqual([false, false, false, false]);
  expect(r.ok ? r.cuts.every((c) => c.profile === TYPESCRIPT && c.component === LEDGER) : r.error).toBe(true);
});

test("Cut Component example 2: Component store, python", () => {
  const r = cutComponent({ record: REC, component: STORE, map: MAP, docs: ["docs/TASK.md"], spec: "ledger.yaml" });
  expect(cards(r)).toStrictEqual(fixtureJson("planner/store.cut.json"));
  expect(r.ok ? r.cuts.every((c) => c.profile === PYTHON) : r.error).toBe(true);
});

test("Cut Component example 3: no map, no docs", () => {
  const r = cutComponent({ record: REC, component: LEDGER, map: EMPTY_MAP, docs: [], spec: "ledger.yaml" });
  const cs = cards(r);
  expect(cs.map((c) => c.customId)).toStrictEqual(["parse-entry", "sum-entries", "check-ledger", "format-report", "ledger-cli"]);
  expect(cs.map((c) => c.dependsOn)).toStrictEqual([[], ["parse-entry"], ["parse-entry", "sum-entries"], ["sum-entries"], ["format-report", "check-ledger"]]);
  expect(cs[0]?.contextSlice).toStrictEqual(["src/ledger/parseEntry.ts"]);
  expect(cs[1]?.contextSlice).toStrictEqual(["src/ledger/parseEntry.ts"]);
  expect(cs.every((c) => c.instruction.startsWith("Every name you need is below -- the record `ledger.yaml` is cut"))).toBe(true);
  expect(cs[2]?.instruction.includes("## Interface check API")).toBe(true);
  expect(cs.map((c) => c.maxTokens)).toStrictEqual([15000, 18500, 19000, 16500, 12000]);
});

test("Cut Component example 4: the faults", () => {
  const input = (over: Partial<CutInput>): CutInput => ({ record: REC, component: LEDGER, map: MAP, docs: [], spec: "s", ...over });
  expect(err(cutComponent(input({ component: { ...LEDGER, language: "go" } }))))
    .toBe("Component 'ledger': unknown language 'go' (known: typescript, python)");
  const bad = record("contour/badCalls.json");
  expect(err(cutComponent(input({ record: bad, component: bad.system.groups[0] as Component }))))
    .toBe("Function 'A' calls unknown Function 'B' of Component 'loop'");
  expect(err(cutComponent(input({ component: { ...LEDGER, interfaces: [{ name: "x", description: "d", exposes: ["Nope"] }] } }))))
    .toBe("Interface 'x' exposes unknown Function 'Nope'");
  const groups: MapGroup[] = [{ name: "parse-entry", functions: ["Sum Entries"] }];
  expect(err(cutComponent(input({ map: { ...EMPTY_MAP, groups } })))).toBe("duplicate customId 'parse-entry'");
});

test("§2.2: an override's instruction is the opening, the record follows; the acceptance by profile", () => {
  const cs = cards(cutComponent({ record: REC, component: LEDGER, map: MAP, docs: ["docs/TASK.md"], spec: "ledger.yaml" }));
  const fr = cs.find((c) => c.customId === "format-report");
  expect(fr?.instruction.startsWith("Write the report formatter.\n\n## Function Format Report\n\n")).toBe(true);
  expect(fr?.instruction.includes("Read docs/TASK.md FIRST")).toBe(false);
  const checks = cs.find((c) => c.customId === "checks");
  expect(checks?.acceptance?.startsWith("D=/tmp/morph/checks; mkdir -p $D;")).toBe(true);
  expect(checks?.instruction.endsWith(TYPESCRIPT.finale)).toBe(true);
  expect(checks?.reasoning).toStrictEqual({ maxTokens: 2500 });
  const named = cutComponent({ record: REC, component: { ...LEDGER, name: "--" }, map: EMPTY_MAP, docs: [], spec: "s" });
  expect(err(named)).toBe("no letters or digits in name '--'");
});

test("§2.2: the types", () => {
  expectTypeOf(cutUnits).parameters.toEqualTypeOf<[Component, readonly MapGroup[]]>();
  expectTypeOf(cutComponent).returns.toEqualTypeOf<CutResult>();
  expectTypeOf<CutInput>().toEqualTypeOf<{ record: ContourRecord; component: Component; map: ContourMap; docs: string[]; spec: string }>();
  expectTypeOf<UnitsResult>().toEqualTypeOf<{ ok: true; units: { id: string; name: string; functions: ContourFunction[]; isGroup: boolean }[] } | { ok: false; error: string }>();
});
