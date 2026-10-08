// P19a probe for cut-component by docs/TASK_P19a_deps.md §2.2 (src/planner/cut.ts) — componentDependencies in record
// order, the language check, the finale from Dependency Finale; a dependency-free cut unchanged (issue #10). Record Cut
// Component examples 1 (unchanged), 6, 7, then rows.
import { test, expect } from "vitest";
import { componentDependencies, cutComponent } from "../../src/planner/cut.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { TYPESCRIPT } from "../../src/language/profiles.js";
import type { Component, ContourMap, ContourRecord } from "../../src/contour/types.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

function rec(name: string): ContourRecord {
  const r = loadContour(fixture(name), name);
  if (!r.ok) throw new Error(r.error);
  return r.record;
}
function cmap(name: string): ContourMap {
  const m = loadMap(fixture(name), name);
  if (!m.ok) throw new Error(m.error);
  return m.map;
}
const DEPS = rec("planner/deps.yaml");
const DMAP = cmap("planner/deps.map.json");
const comp = (r: ContourRecord, n: string): Component => r.system.groups.find((g) => g.name === n) as Component;
const cut = (n: string): ReturnType<typeof cutComponent> =>
  cutComponent({ record: DEPS, component: comp(DEPS, n), map: DMAP, docs: ["docs/TASK.md"], spec: "deps.yaml" });
const TS_TAIL = " Imports: the standard library plus yaml@2.8.1, zod@3.23.8; their API is in docs/deps/yaml.md; no other import.";

test("Cut Component example 1: the dependency-free ledger cut is unchanged", () => {
  const ledger = rec("planner/ledger.yaml");
  const r = cutComponent({ record: ledger, component: comp(ledger, "ledger"), map: cmap("planner/ledger.map.json"), docs: ["docs/TASK.md"], spec: "ledger.yaml" });
  expect(r.ok && r.cuts.map((c) => c.card)).toStrictEqual(fixtureJson("planner/ledger.cut.json"));
});

test("Cut Component example 6: the finale of conf, diff and plain", () => {
  const conf = cut("conf");
  expect(conf.ok && conf.cuts.map((c) => [c.card.customId, c.card.instruction.endsWith("\n\n" + TYPESCRIPT.finale + TS_TAIL)]))
    .toStrictEqual([["read-config", true], ["check-config", true]]);
  const diff = cut("diff");
  const d = diff.ok ? diff.cuts[0].card.instruction : "";
  expect(d.endsWith("never your own helper; no t.Skip, no network, no clock, no goroutine left running. Imports: the standard library plus github.com/google/go-cmp@v0.7.0; their API is in docs/deps/go-cmp.md; no other import.")).toBe(true);
  expect(d.includes("Go 1.22, the standard library and the modules named at the end (go.mod requires them;")).toBe(true);
  const plain = cut("plain");
  expect(plain.ok && plain.cuts.map((c) => [c.card.customId, c.card.instruction.endsWith("\n\n" + TYPESCRIPT.finale)])).toStrictEqual([["pad-left", true]]);
  expect(componentDependencies(DEPS, comp(DEPS, "plain"))).toStrictEqual([]);
});

test("Cut Component example 7: a go dependency in a typescript Component", () => {
  expect(cut("wrong")).toStrictEqual({ ok: false, error: "Component 'wrong' uses 'github.com/google/go-cmp', a go dependency (the Component is typescript)" });
});

test("row: componentDependencies in record order, not uses order; the language check before the links", () => {
  expect(componentDependencies(DEPS, comp(DEPS, "conf"))).toStrictEqual([
    { name: "yaml", version: "2.8.1", language: "typescript", doc: "docs/deps/yaml.md" },
    { name: "zod", version: "3.23.8", language: "typescript", doc: null }]);
  const wrong = comp(DEPS, "wrong");
  const looped: Component = { ...wrong, functions: [{ ...wrong.functions[0], steps: [{ verb: "calls", target: "Mix" }] }] };
  expect(cutComponent({ record: DEPS, component: looped, map: DMAP, docs: [], spec: "deps.yaml" }))
    .toStrictEqual({ ok: false, error: "Component 'wrong' uses 'github.com/google/go-cmp', a go dependency (the Component is typescript)" });
  const golike: Component = { ...wrong, language: "Go" };
  const g = cutComponent({ record: DEPS, component: golike, map: DMAP, docs: [], spec: "deps.yaml" });
  expect(g.ok && g.cuts[0].card.instruction.endsWith("go-cmp@v0.7.0; their API is in docs/deps/go-cmp.md; no other import.")).toBe(true);
  const pyDeps: ContourRecord = { ...DEPS, system: { ...DEPS.system, dependencies: [{ name: "yaml", version: "1", language: "Typescript", doc: null }] } };
  expect(cutComponent({ record: pyDeps, component: comp(DEPS, "conf"), map: DMAP, docs: [], spec: "deps.yaml" }))
    .toStrictEqual({ ok: false, error: "Component 'conf' uses 'yaml', a Typescript dependency (the Component is typescript)" });
});
