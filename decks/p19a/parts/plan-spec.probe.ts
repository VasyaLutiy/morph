// P19a probe for plan-spec by docs/TASK_P19a_deps.md §2.2 (src/planner/types.ts, src/planner/plan.ts) — the doc check
// after each Component's cut, the docs appended to the slices of its cards and their judges, uses per code card; a
// dependency-free plan unchanged with uses {}; the map's own lists never changed (issue #10). Record Plan Spec examples 1, 6, 7, then rows.
import { test, expect } from "vitest";
import { planSpec } from "../../src/planner/plan.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import type { ContourMap, ContourRecord } from "../../src/contour/types.js";
import type { PlanInput, PlanResult } from "../../src/planner/types.js";
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
const deps = (over: Partial<PlanInput>): PlanResult =>
  planSpec({ record: DEPS, map: DMAP, spec: "deps.yaml", components: ["conf", "diff", "plain"], judge: true, hasFile: () => true, ...over });

test("Plan Spec example 1: the dependency-free ledger plan is unchanged, uses {}", () => {
  const r = planSpec({ record: rec("planner/ledger.yaml"), map: cmap("planner/ledger.map.json"), spec: "ledger.yaml",
    components: ["ledger", "store"], judge: true, hasFile: (p) => p === "tests/helpers.ts" });
  expect(r.ok && r.plan).toStrictEqual(fixtureJson("planner/ledger.plan.json"));
  expect(r.ok && r.uses).toStrictEqual({});
});

test("Plan Spec example 6: the docs in the slices, uses per code card", () => {
  const r = deps({});
  if (!r.ok) throw new Error(r.error);
  const slices = Object.fromEntries(r.plan.cards.map((c) => [c.customId, c.contextSlice]));
  expect(slices).toStrictEqual({
    "read-config": ["docs/TASK.md", "docs/deps/yaml.md"],
    "check-config": ["docs/X.md", "docs/deps/yaml.md"],
    "read-config-judge": ["docs/TASK.md", "src/conf/readConfig.ts", "tests/helpers.ts", "docs/deps/yaml.md"],
    "check-config-judge": ["docs/TASK.md", "src/conf/checkConfig.ts", "tests/helpers.ts", "docs/deps/yaml.md"],
    "diff-values": ["docs/TASK.md", "docs/deps/go-cmp.md"],
    "diff-values-judge": ["docs/TASK.md", "diff/diff_values.go", "internal/testhelp/testhelp.go", "docs/deps/go-cmp.md"],
    "pad-left": ["docs/TASK.md"],
    "pad-left-judge": ["docs/TASK.md", "src/plain/padLeft.ts", "tests/helpers.ts"],
  });
  expect(r.uses).toStrictEqual({ "read-config": ["yaml", "zod"], "check-config": ["yaml", "zod"], "diff-values": ["github.com/google/go-cmp"] });
  expect(r.plan.generations).toStrictEqual([["diff-values", "pad-left", "read-config"],
    ["check-config", "diff-values-judge", "pad-left-judge", "read-config-judge"], ["check-config-judge"]]);
  expect(Object.keys(r.plan)).toStrictEqual(["spec", "components", "cards", "generations", "externalDependsOn"]);
});

test("Plan Spec example 7: a missing doc names its dependency", () => {
  expect(deps({ components: ["conf", "diff"], judge: false, hasFile: (p) => p !== "docs/deps/go-cmp.md" })).toStrictEqual({
    ok: false, error: "dependency 'github.com/google/go-cmp' of Component 'diff': doc file not found: docs/deps/go-cmp.md" });
  expect(deps({ components: ["conf"], judge: false, hasFile: () => false })).toStrictEqual({
    ok: false, error: "dependency 'yaml' of Component 'conf': doc file not found: docs/deps/yaml.md" });
  const plain = deps({ components: ["plain"], hasFile: () => false });
  expect(plain.ok && plain.uses).toStrictEqual({});
});

test("row: the doc check follows each Component's own cut; the spec never rides; extra cards get no doc", () => {
  const once = deps({});
  expect(once.ok && once.plan.cards.find((c) => c.customId === "check-config")?.contextSlice).toStrictEqual(["docs/X.md", "docs/deps/yaml.md"]);
  expect(DMAP.cards.find((c) => c.id === "check-config")?.contextSlice).toStrictEqual(["docs/X.md"]);
  expect(deps({ components: ["diff", "wrong"], hasFile: (p) => p !== "docs/deps/go-cmp.md" })).toStrictEqual({
    ok: false, error: "dependency 'github.com/google/go-cmp' of Component 'diff': doc file not found: docs/deps/go-cmp.md" });
  expect(deps({ components: ["wrong", "diff"], hasFile: (p) => p !== "docs/deps/go-cmp.md" })).toStrictEqual({
    ok: false, error: "Component 'wrong' uses 'github.com/google/go-cmp', a go dependency (the Component is typescript)" });
  const both: ContourRecord = { ...DEPS, system: { ...DEPS.system, dependencies: DEPS.system.dependencies.map((d) =>
    d.name === "zod" ? { ...d, doc: "deps.yaml" } : d.name === "yaml" ? { ...d, doc: "docs/X.md" } : d) } };
  const extra: ContourMap = { ...DMAP, extraCards: [{ component: "conf", customId: "conf-extra", intent: null, targets: ["src/conf/x.ts"],
    contextSlice: ["docs/E.md"], dependsOn: null, instruction: "x", acceptance: null, model: null, maxTokens: null, reasoningMaxTokens: null, variants: null }] };
  const r = planSpec({ record: both, map: extra, spec: "deps.yaml", components: ["conf"], judge: false, hasFile: () => true });
  if (!r.ok) throw new Error(r.error);
  expect(r.plan.cards.map((c) => [c.customId, c.contextSlice])).toStrictEqual([
    ["conf-extra", ["docs/E.md"]], ["read-config", ["docs/TASK.md", "docs/X.md"]], ["check-config", ["docs/X.md"]]]);
  expect(r.uses).toStrictEqual({ "read-config": ["yaml", "zod"], "check-config": ["yaml", "zod"] });
  const shared: ContourRecord = { ...DEPS, system: { ...DEPS.system, dependencies: DEPS.system.dependencies.map((d) =>
    d.name === "zod" ? { ...d, doc: "docs/deps/yaml.md" } : d) } };
  const s2 = planSpec({ record: shared, map: DMAP, spec: "deps.yaml", components: ["conf"], judge: false, hasFile: () => true });
  expect(s2.ok && s2.plan.cards.map((c) => [c.customId, c.contextSlice])).toStrictEqual([
    ["read-config", ["docs/TASK.md", "docs/deps/yaml.md"]], ["check-config", ["docs/X.md", "docs/deps/yaml.md"]]]);
});
