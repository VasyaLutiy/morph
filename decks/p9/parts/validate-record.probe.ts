// P9 probe for validate-record: validateRecord by docs/TASK_P9_contour.md §2.2, one test per record example
// (Component contour, Validate Record 1-6), then the §2.2 rows and the types.
import { test, expect, expectTypeOf } from "vitest";
import { STEP_VERBS, validateRecord } from "../../src/contour/record.js";
import type { Component, ContourRecord, RecordResult, StepVerb } from "../../src/contour/types.js";
import { fixtureJson } from "../../tests/helpers.js";

const SYS = (groups: unknown[]): Record<string, unknown> => ({ System: { name: "s", description: "d", groups } });
const FN = (extra: Record<string, unknown>): Record<string, unknown> =>
  ({ name: "f", description: "F.", behavior: "B.", examples: [{ given: "g", when: "w", then: "t" }], ...extra });
const problems = (r: RecordResult): string[] => (r.ok ? [] : r.problems);

test("Validate Record example 1: the mini record", () => {
  expect(validateRecord(fixtureJson("contour/mini.json"))).toStrictEqual({ ok: true, record: fixtureJson("contour/mini.typed.json") });
});

test("Validate Record example 2: the bad record, 19 problems in walk order", () => {
  expect(validateRecord(fixtureJson("contour/badRecord.json"))).toStrictEqual({ ok: false, problems: fixtureJson("contour/badRecord.problems.json") });
});

test("Validate Record example 3: not an object", () => {
  for (const doc of [[], null, "x"]) expect(validateRecord(doc)).toStrictEqual({ ok: false, problems: ["(root): a record must be an object"] });
});

test("Validate Record example 4: the empty document", () => {
  expect(validateRecord({})).toStrictEqual({ ok: false, problems: ["System: required"] });
});

test("Validate Record example 5: no version, trimmed, no Component", () => {
  expect(validateRecord({ System: { name: " s ", description: "d", groups: [] } })).toStrictEqual({ ok: true, record: {
    version: 1, system: { name: "s", description: "d", requirements: [], guardrails: [], groups: [] },
    actors: [], requirements: [], guardrails: [] } });
});

test("Validate Record example 6: version \"1\" and a Function without examples", () => {
  expect(validateRecord({ version: "1", System: { name: "s", description: "d", groups: [{ name: "c", description: "C.",
    functions: [{ name: "f", description: "F.", behavior: "B." }] }] } }))
    .toStrictEqual({ ok: false, problems: ["version: must be 1", "System.groups[0].functions[0].examples: required"] });
});

test("§2.2: walk order — required, then unknown keys in object order, then values", () => {
  expect(problems(validateRecord({ zz: 1, System: { b: 2, groups: 3, a: 1 }, version: 2, Guardrail: {} }))).toStrictEqual([
    "(root): unknown key 'zz' (known: version, System, Actor, Requirement, Guardrail)",
    "version: must be 1",
    "System.name: required", "System.description: required",
    "System: unknown key 'b' (known: name, description, requirements, guardrails, groups)",
    "System: unknown key 'a' (known: name, description, requirements, guardrails, groups)",
    "System.groups: must be a list",
    "Guardrail: must be a list",
  ]);
  expect(problems(validateRecord({ System: "x" }))).toStrictEqual(["System: must be an object"]);
});

test("§2.2: schema text, mapping, steps, ref and language", () => {
  const r = validateRecord(SYS([{ name: " c ", description: " C. ", language: " typescript ",
    functions: [FN({ steps: [{ calls: " g " }, { reads: "D" }], examples: [{ given: " g ", when: "w", then: "t", ref: " R " }] })],
    dataObjects: [{ name: "D", description: "D.", schema: { b: " x ", a: "y" } }, { name: "E", description: "E.", schema: " s " }, { name: "F", description: "F." }] }]));
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  const c = r.record.system.groups[0] as Component;
  expect(c.name).toBe("c");
  expect(c.language).toBe("typescript");
  expect(c.functions[0]?.steps).toStrictEqual([{ verb: "calls", target: "g" }, { verb: "reads", target: "D" }]);
  expect(c.functions[0]?.examples).toStrictEqual([{ given: "g", when: "w", then: "t", ref: "R" }]);
  expect(c.dataObjects.map((d) => d.schema)).toStrictEqual(['{\n  "b": "x",\n  "a": "y"\n}', "s", null]);
  expect(JSON.stringify(c.functions[0])).toBe(JSON.stringify({ name: "f", description: "F.", behavior: "B.", requirements: [], guardrails: [],
    preconditions: [], steps: [{ verb: "calls", target: "g" }, { verb: "reads", target: "D" }], examples: [{ given: "g", when: "w", then: "t", ref: "R" }] }));
  expect(Object.keys(r.record).join(",")).toBe("version,system,actors,requirements,guardrails");
  expect(Object.keys(c).join(",")).toBe("name,description,language,requirements,guardrails,functions,dataObjects,interfaces");
});

test("§2.2: bad steps, schema values, lists and items", () => {
  expect(problems(validateRecord(SYS([{ name: "c", description: "C.", functions: [FN({ steps: [{}, "x", { calls: "a", uses: "b" }, { make: "x" }, { reads: 3 }] })],
    dataObjects: [{ name: "D", description: "D.", schema: { a: "" } }, { name: "E", description: "E.", schema: [] }, { name: "G", description: "G.", schema: null }] }])))).toStrictEqual([
    "System.groups[0].functions[0].steps[0]: a step is an object with exactly one key",
    "System.groups[0].functions[0].steps[1]: a step is an object with exactly one key",
    "System.groups[0].functions[0].steps[2]: a step is an object with exactly one key",
    "System.groups[0].functions[0].steps[3]: unknown step verb 'make' (known: calls, reads, modifies, produces, uses)",
    "System.groups[0].functions[0].steps[4].reads: must be a non-empty string",
    "System.groups[0].dataObjects[0].schema.a: must be a non-empty string",
    "System.groups[0].dataObjects[1].schema: must be a non-empty string",
    "System.groups[0].dataObjects[2].schema: must be a non-empty string",
  ]);
  expect(problems(validateRecord(SYS([{ name: "c", description: "  ", functions: "f", interfaces: [{ name: "I", description: "I.", exposes: "x" }],
    requirements: ["a", 2] }])))).toStrictEqual([
    "System.groups[0].description: must be a non-empty string",
    "System.groups[0].requirements[1]: must be a non-empty string",
    "System.groups[0].functions: must be a list",
    "System.groups[0].interfaces[0].exposes: must be a list",
  ]);
});

test("§2.2: duplicates — Data Objects across the record, Functions within their Component only", () => {
  expect(problems(validateRecord(SYS([
    { name: "a", description: "A.", functions: [FN({})], dataObjects: [{ name: "D", description: "D." }] },
    { name: " b", description: "B.", functions: [FN({})], dataObjects: [{ name: " D ", description: "D." }] },
    { name: "b ", description: "B." }])))).toStrictEqual([
    "System.groups[1].dataObjects[0].name: duplicate Data Object name 'D'",
    "System.groups[2].name: duplicate Component name 'b'",
  ]);
  expect(problems(validateRecord({ ...SYS([]), Actor: [{ name: "U", description: "U.", uses: [""], extra: 1 }], Requirement: ["R"] }))).toStrictEqual([
    "Actor[0]: unknown key 'extra' (known: name, description, uses)",
    "Actor[0].uses[0]: must be a non-empty string",
    "Requirement[0]: must be an object",
  ]);
});

test("§2.2: preconditions and an Interface are typed; an empty Function list is fine", () => {
  const r = validateRecord(SYS([{ name: "c", description: "C.", functions: [FN({ preconditions: [" p "] })],
    interfaces: [{ name: "I", description: "I.", exposes: ["f"] }] }]));
  expect(r.ok ? r.record.system.groups[0]?.functions[0]?.preconditions : r.problems).toStrictEqual(["p"]);
  expect(r.ok ? r.record.system.groups[0]?.interfaces : r.problems).toStrictEqual([{ name: "I", description: "I.", exposes: ["f"] }]);
  expect(validateRecord(SYS([{ name: "c", description: "C.", functions: [] }])).ok).toBe(true);
});

test("§2.2: the types", () => {
  expectTypeOf(validateRecord).toEqualTypeOf<(doc: unknown) => RecordResult>();
  expectTypeOf(STEP_VERBS).toEqualTypeOf<readonly StepVerb[]>();
  expect(STEP_VERBS).toStrictEqual(["calls", "reads", "modifies", "produces", "uses"]);
  expectTypeOf<Extract<RecordResult, { ok: true }>["record"]>().toEqualTypeOf<ContourRecord>();
  expectTypeOf<ContourRecord["version"]>().toEqualTypeOf<1>();
});
