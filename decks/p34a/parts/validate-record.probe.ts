// P34a probe for validate-record by docs/TASK_P34a_contour.md §2.2 (src/contour/types.ts, src/contour/record.ts) —
// issue #44: the whole Contour key set, unknown keys as warnings, behavior and examples optional. Record Component
// contour, Validate Record examples 1-10 (3, 4, 5 unchanged).
import { test, expect } from "vitest";
import { validateRecord } from "../../src/contour/record.js";
import { fixtureJson } from "../../tests/helpers.js";

test("Validate Record example 1: the mini record gives the whole typed record with the new empty lists, no warnings key", () => {
  expect(validateRecord(fixtureJson("contour/mini.json"))).toStrictEqual({ ok: true, record: fixtureJson("contour/mini.typed.json") });
});

test("Validate Record example 2: the bad record gives its 19 problems, the unknown keys dropped", () => {
  expect(validateRecord(fixtureJson("contour/badRecord.json"))).toStrictEqual({ ok: false, problems: fixtureJson("contour/badRecord.problems.json") });
});

test("Validate Record example 3: a non-object root (unchanged)", () => {
  for (const doc of [[], null, "x"]) {
    expect(validateRecord(doc)).toStrictEqual({ ok: false, problems: ["(root): a record must be an object"] });
  }
});

test("Validate Record example 4: an empty document misses only System (unchanged)", () => {
  expect(validateRecord({})).toStrictEqual({ ok: false, problems: ["System: required"] });
});

test("Validate Record example 5: no version means 1, texts trimmed (unchanged)", () => {
  expect(validateRecord({ System: { name: " s ", description: "d", groups: [] } })).toStrictEqual({
    ok: true,
    record: {
      version: 1,
      system: { name: "s", description: "d", requirements: [], guardrails: [], groups: [], dependencies: [] },
      actors: [], requirements: [], guardrails: [],
    },
  });
});

test("Validate Record example 6: version must be the number 1 and examples are optional", () => {
  expect(validateRecord({
    version: "1",
    System: { name: "s", description: "d", groups: [{ name: "c", description: "C.", functions: [{ name: "f", description: "F.", behavior: "B." }] }] },
  })).toStrictEqual({ ok: false, problems: ["version: must be 1"] });
});

test("Validate Record example 7: the deps record with the new empty lists", () => {
  expect(validateRecord(fixtureJson("contour/deps.json"))).toStrictEqual({ ok: true, record: fixtureJson("contour/deps.typed.json") });
});

test("Validate Record example 8: the bad deps record keeps 15 problems, its unknown key a warning", () => {
  expect(validateRecord(fixtureJson("contour/badDeps.json"))).toStrictEqual({ ok: false, problems: fixtureJson("contour/badDeps.problems.json") });
});

test("Validate Record example 9: the contour-keys record loads with its 10 warnings", () => {
  expect(validateRecord(fixtureJson("contour/contourKeys.json"))).toStrictEqual({
    ok: true,
    record: fixtureJson("contour/contourKeys.typed.json"),
    warnings: fixtureJson("contour/contourKeys.warnings.json"),
  });
});

test("Validate Record example 10: a nested mapping schema is JSON with keys sorted at every depth", () => {
  const r = validateRecord({
    System: { name: "s", description: "d", groups: [{ name: "c", description: "C.",
      dataObjects: [{ name: "d", description: "D.", schema: { b: { z: 1, a: "x" }, a: ["q", { d: true, c: null }] } }] }] },
  });
  expect(r.ok).toBe(true);
  expect("warnings" in r).toBe(false);
  expect(r.ok ? r.record.system.groups[0].dataObjects[0].schema : null).toBe(
    JSON.stringify({ a: ["q", { c: null, d: true }], b: { a: "x", z: 1 } }, null, 2),
  );
});
