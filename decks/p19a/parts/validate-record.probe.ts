// P19a probe for validate-record by docs/TASK_P19a_deps.md §2.2 (src/contour/types.ts, src/contour/record.ts) — System
// .dependencies and Component.uses validated, every fault named in document order, absent lists [] (issue #10). Record
// Validate Record examples 1, 2, 5 (changed by P19), 7, 8, then rows.
import { test, expect } from "vitest";
import { EXACT_VERSION, validateRecord } from "../../src/contour/record.js";
import type { Component, ContourSystem, Dependency } from "../../src/contour/types.js";
import { fixtureJson } from "../../tests/helpers.js";

const fn = { name: "f", description: "F.", behavior: "B.", examples: [{ given: "g", when: "w", then: "t" }] };
const sys = (over: Record<string, unknown>): unknown => ({ System: { name: "s", description: "d", groups: [], ...over } });

test("Validate Record example 1: the mini record gains dependencies [] and uses [] in the typed record", () => {
  expect(validateRecord(fixtureJson("contour/mini.json"))).toStrictEqual({ ok: true, record: fixtureJson("contour/mini.typed.json") });
});

test("Validate Record example 2: the bad record's Component key table names uses after guardrails", () => {
  expect(validateRecord(fixtureJson("contour/badRecord.json"))).toStrictEqual({ ok: false, problems: fixtureJson("contour/badRecord.problems.json") });
});

test("Validate Record example 5: no dependency means []", () => {
  expect(validateRecord({ System: { name: " s ", description: "d", groups: [] } })).toStrictEqual({
    ok: true,
    record: { version: 1, system: { name: "s", description: "d", requirements: [], guardrails: [], groups: [], dependencies: [] },
      actors: [], requirements: [], guardrails: [] },
  });
});

test("Validate Record example 7: the deps record gives the whole typed record", () => {
  expect(validateRecord(fixtureJson("contour/deps.json"))).toStrictEqual({ ok: true, record: fixtureJson("contour/deps.typed.json") });
});

test("Validate Record example 8: every dependency and uses fault, in order; none declared; dependencies not a list", () => {
  expect(validateRecord(fixtureJson("contour/badDeps.json"))).toStrictEqual({ ok: false, problems: fixtureJson("contour/badDeps.problems.json") });
  expect(validateRecord(sys({ groups: [{ name: "c", description: "C.", uses: ["yaml"], functions: [fn] }] }))).toStrictEqual({
    ok: false, problems: ["System.groups[0].uses[0]: unknown dependency 'yaml' (declared: none)"] });
  expect(validateRecord(sys({ dependencies: {} }))).toStrictEqual({ ok: false, problems: ["System.dependencies: must be a list"] });
});

test("row: EXACT_VERSION takes exact versions only", () => {
  const exact = ["1", "6.0", "2.8.1", "v0.7.0", "v0.0.0-20240521000000-abcdef123456", "1.0.0-rc.1+build.5", "10.20.30.40"];
  const loose = ["", "v", "^2.8.1", "~1.2", ">=1.0.0", "1.x", "1.2.*", "*", "latest", "2.8.1 - 3", "1.0.0 ", "=1.0.0", "1..2", ".1", "1.", "x1.0"];
  expect(exact.map((v) => [v, EXACT_VERSION.test(v)])).toStrictEqual(exact.map((v) => [v, true]));
  expect(loose.map((v) => [v, EXACT_VERSION.test(v)])).toStrictEqual(loose.map((v) => [v, false]));
});

test("row: a padded version is trimmed before the check; a declared name counts before the groups, padded or repeated", () => {
  const r = validateRecord(sys({
    groups: [{ name: "c", description: "C.", uses: [" b ", "a"], functions: [fn] }],
    dependencies: [{ name: " a ", version: " v1.2.3 ", language: " go ", doc: " d.md " }, { name: "b", version: "1", language: "python" }],
  }));
  const deps: Dependency[] = [{ name: "a", version: "v1.2.3", language: "go", doc: "d.md" }, { name: "b", version: "1", language: "python", doc: null }];
  expect(r.ok && r.record.system.dependencies).toStrictEqual(deps);
  const c: Component | null = r.ok ? r.record.system.groups[0] : null;
  expect(c?.uses).toStrictEqual(["b", "a"]);
  const s: ContourSystem | null = r.ok ? r.record.system : null;
  expect(s === null ? [] : Object.keys(s)).toStrictEqual(["name", "description", "requirements", "guardrails", "groups", "dependencies"]);
  expect(validateRecord(sys({ dependencies: [{ name: "a", version: "1", language: "go" }, { name: "a", version: "2", language: "go" }],
    groups: [{ name: "c", description: "C.", uses: ["a", "z"], functions: [fn] }] }))).toStrictEqual({ ok: false, problems: [
    "System.groups[0].uses[1]: unknown dependency 'z' (declared: a)", "System.dependencies[1].name: duplicate dependency name 'a'"] });
});

test("row: the unknown-key tables of System and of a dependency", () => {
  expect(validateRecord(sys({ deps: [] }))).toStrictEqual({ ok: false, problems: [
    "System: unknown key 'deps' (known: name, description, requirements, guardrails, groups, dependencies)"] });
  expect(validateRecord(sys({ dependencies: [{ name: "a", version: "1", language: "go", doc: "x", dev: true }, { name: "b" }] }))).toStrictEqual({
    ok: false, problems: [
      "System.dependencies[0]: unknown key 'dev' (known: name, version, language, doc)",
      "System.dependencies[1].version: required", "System.dependencies[1].language: required"] });
});
