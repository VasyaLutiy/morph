// P9 probe for select-components: selectComponents, functionLinks, componentSlug by docs/TASK_P9_contour.md
// §2.2, one test per record example (Component contour, Select Components 1-3, Function Links 1-3), then the
// §2.2 rows and the types. The harness skeleton is §2.1's, verbatim.
import { test, expect, expectTypeOf } from "vitest";
import { componentSlug, functionLinks, selectComponents } from "../../src/contour/select.js";
import { fixtureJson } from "../../tests/helpers.js";
import { validateRecord } from "../../src/contour/record.js";
import type { ContourRecord, Component, LinksResult, SelectResult } from "../../src/contour/types.js";
function typed(name: string): ContourRecord {
  const r = validateRecord(fixtureJson(name));
  if (!r.ok) throw new Error(r.problems.join("\n"));
  return r.record;
}
const MINI = typed("contour/mini.json");
const TALLY = MINI.system.groups[0] as Component;
const STORE = MINI.system.groups[1] as Component;

test("Select Components example 1: no names", () => {
  expect(selectComponents(MINI, [])).toStrictEqual({ ok: false, error: "the record has 2 Components (tally, store): pass --component" });
  const one = selectComponents({ ...MINI, system: { ...MINI.system, groups: [TALLY] } }, []);
  expect(one.ok ? one.components.length === 1 && one.components[0] === TALLY : one.error).toBe(true);
});

test("Select Components example 2: by slug, given order, a repeat once", () => {
  const r = selectComponents(MINI, ["Store", "tally", "store"]);
  expect(r.ok ? r.components.length : r.error).toBe(2);
  expect(r.ok ? r.components[0] : null).toBe(STORE);
  expect(r.ok ? r.components[1] : null).toBe(TALLY);
});

test("Select Components example 3: an unknown name", () => {
  expect(selectComponents(MINI, ["tally", "nope"])).toStrictEqual({ ok: false, error: "no Component 'nope' in the record (have: tally, store)" });
});

test("Function Links example 1: Component tally", () => {
  expect(functionLinks(MINI, TALLY)).toStrictEqual({ ok: true, links: [
    { function: "Count Words", calls: [], dataObjects: [], uses: [] },
    { function: "Report Count", calls: ["Count Words"], dataObjects: ["Text File"], uses: ["node:fs"] }] });
});

test("Function Links example 2: Component store", () => {
  expect(functionLinks(MINI, STORE)).toStrictEqual({ ok: true, links: [
    { function: "Save Count", calls: [], dataObjects: ["Count Record"], uses: ["tally"] },
    { function: "Load Counts", calls: [], dataObjects: ["Count Record", "Text File"], uses: [] }] });
});

test("Function Links example 3: an unknown callee and a self call", () => {
  const BAD = typed("contour/badCalls.json");
  expect(functionLinks(BAD, BAD.system.groups[0] as Component)).toStrictEqual({ ok: false, errors: [
    "Function 'A' calls unknown Function 'B' of Component 'loop'", "Function 'C' calls itself"] });
});

test("§2.2: componentSlug and the slug match", () => {
  expect(componentSlug("  Run--Loop 2 ")).toBe("run-loop-2");
  expect(componentSlug("!!")).toBe("");
  const r = selectComponents(MINI, ["TALLY!"]);
  expect(r.ok ? r.components[0] : null).toBe(TALLY);
  expect(selectComponents({ ...MINI, system: { ...MINI.system, groups: [] } }, []))
    .toStrictEqual({ ok: false, error: "the record has 0 Components (): pass --component" });
});

test("§2.2: the first unmatched name stops; an exact name wins in record order", () => {
  expect(selectComponents(MINI, ["x", "y"])).toStrictEqual({ ok: false, error: "no Component 'x' in the record (have: tally, store)" });
  const r = selectComponents(MINI, ["store", "Tally"]);
  expect(r.ok ? r.components.map((c) => c.name).join(",") : r.error).toBe("store,tally");
});

test("§2.2: steps — uses and data objects distinct in step order, other targets ignored", () => {
  const f = { name: "F", description: "F.", behavior: "B.", requirements: [], guardrails: [], preconditions: [],
    examples: [{ given: "g", when: "w", then: "t", ref: null }],
    steps: [{ verb: "uses" as const, target: "b" }, { verb: "produces" as const, target: "Count Record" }, { verb: "uses" as const, target: "a" },
      { verb: "uses" as const, target: "b" }, { verb: "modifies" as const, target: "Text File" }, { verb: "reads" as const, target: "Count Record" },
      { verb: "reads" as const, target: "Nothing" }, { verb: "calls" as const, target: "G" }, { verb: "calls" as const, target: "G" }] };
  const g = { ...f, name: "G", steps: [] };
  const comp: Component = { ...STORE, functions: [f, g] };
  expect(functionLinks(MINI, comp)).toStrictEqual({ ok: true, links: [
    { function: "F", calls: ["G"], dataObjects: ["Count Record", "Text File"], uses: ["b", "a"] },
    { function: "G", calls: [], dataObjects: [], uses: [] }] });
  const k = functionLinks(MINI, TALLY);
  expect(k.ok ? Object.keys(k.links[0] ?? {}).join(",") : "").toBe("function,calls,dataObjects,uses");
});

test("§2.2: the types", () => {
  expectTypeOf(selectComponents).toEqualTypeOf<(record: ContourRecord, names: readonly string[]) => SelectResult>();
  expectTypeOf(functionLinks).toEqualTypeOf<(record: ContourRecord, component: Component) => LinksResult>();
  expectTypeOf(componentSlug).toEqualTypeOf<(name: string) => string>();
});
