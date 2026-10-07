// P9 probe for load-spec: parseDocument, loadContour, loadMap by docs/TASK_P9_contour.md §2.2, one test per
// record example (Component contour, Parse Document 1-3, Load Spec 1-4), then the §2.2 rows and the types.
import { test, expect, expectTypeOf } from "vitest";
import { MAX_LISTED_PROBLEMS, loadContour, loadMap, parseDocument } from "../../src/contour/load.js";
import type { DocResult, LoadMapResult, LoadRecordResult } from "../../src/contour/types.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

const err = (r: { ok: true } | { ok: false; error: string }): string => (r.ok ? "<ok>" : r.error);

test("Parse Document example 1: YAML and JSON", () => {
  expect(parseDocument("a: 1\nb: [x, y]\n", "r.yaml")).toStrictEqual({ ok: true, doc: { a: 1, b: ["x", "y"] } });
  expect(parseDocument('{"a": [1, "2"]}', "m.JSON")).toStrictEqual({ ok: true, doc: { a: [1, "2"] } });
});

test("Parse Document example 2: parser errors, one line, by prefix", () => {
  const a = err(parseDocument("a: 1\n", "m.json"));
  expect(a.startsWith("cannot parse m.json: ") && a.length > 21 && !a.includes("\n")).toBe(true);
  const b = err(parseDocument("a: 1\na: 2\n", "d.yml"));
  expect(b.startsWith("cannot parse d.yml: ") && b.length > 20 && !b.includes("\n")).toBe(true);
});

test("Parse Document example 3: not a mapping", () => {
  expect(parseDocument("- a\n- b\n", "r.yaml")).toStrictEqual({ ok: false, error: "r.yaml is not a mapping at the top level" });
  expect(parseDocument("", "e.yaml")).toStrictEqual({ ok: false, error: "e.yaml is not a mapping at the top level" });
  expect(parseDocument("null", "n.json")).toStrictEqual({ ok: false, error: "n.json is not a mapping at the top level" });
});

test("Load Spec example 1: the mini record from YAML", () => {
  expect(loadContour(fixture("contour/mini.yaml"), "mini.yaml")).toStrictEqual({ ok: true, record: fixtureJson("contour/mini.typed.json") });
});

test("Load Spec example 2: the bad record and the bad map", () => {
  expect(loadContour(fixture("contour/badRecord.json"), "badRecord.json")).toStrictEqual({ ok: false,
    error: "badRecord.json is not a valid record (19 problems):\n" + (fixtureJson("contour/badRecord.problems.json") as string[]).join("\n") });
  expect(loadMap(fixture("contour/badMap.json"), "badMap.json")).toStrictEqual({ ok: false,
    error: "badMap.json is not a valid map (15 problems):\n" + (fixtureJson("contour/badMap.problems.json") as string[]).join("\n") });
});

test("Load Spec example 3: twenty listed, one problem, a parse error", () => {
  const many = JSON.stringify({ System: { name: "s", description: "d", groups: Array.from({ length: 11 }, () => ({})) } });
  const lines = err(loadContour(many, "many.json")).split("\n");
  expect(lines.length).toBe(22);
  expect(lines[0]).toBe("many.json is not a valid record (22 problems):");
  expect(lines[1]).toBe("System.groups[0].name: required");
  expect(lines[20]).toBe("System.groups[9].description: required");
  expect(lines[21]).toBe("… and 2 more");
  expect(loadContour('{"System": {"name": "s", "description": "d"}}', "one.json"))
    .toStrictEqual({ ok: false, error: "one.json is not a valid record (1 problem):\nSystem.groups: required" });
  expect(err(loadMap("a: [", "m.yaml")).startsWith("cannot parse m.yaml: ")).toBe(true);
});

test("Load Spec example 4: this repository's own record and map", () => {
  const r = loadContour(fixture("../../contour.yaml"), "contour.yaml");
  expect(r.ok ? r.record.system.name : r.error).toBe("MorphV2");
  expect(r.ok ? r.record.system.groups.some((c) => c.name === "contour") : false).toBe(true);
  expect(r.ok ? r.record.system.groups.every((c) => c.functions.every((f) => f.examples.length >= 1)) : false).toBe(true);
  const m = loadMap(fixture("../../morph-map.json"), "morph-map.json");
  expect(m.ok ? m.map.package : m.error).toBe("src");
  expect(m.ok ? m.map.cards.some((c) => c.id === "validate-record") : false).toBe(true);
});

test("§2.2: the error object is passed through; ok results are the validators'", () => {
  expect(loadContour("[]", "a.json")).toStrictEqual({ ok: false, error: "a.json is not a mapping at the top level" });
  expect(loadMap("{}", "m.yml")).toStrictEqual({ ok: true, map: { version: 1, package: null, language: null, docs: [], groups: [], cards: [], extraCards: [] } });
  expect(loadMap('{"version": 2}', "m.json")).toStrictEqual({ ok: false, error: "m.json is not a valid map (1 problem):\nversion: must be 1" });
});

test("§2.2: exactly twenty lines, no tail; the parser by the name", () => {
  const twenty = JSON.stringify({ System: { name: "s", description: "d", groups: Array.from({ length: 10 }, () => ({})) } });
  const t = err(loadContour(twenty, "t.json")).split("\n");
  expect(t.length).toBe(21);
  expect(t[0]).toBe("t.json is not a valid record (20 problems):");
  expect(t[20]).toBe("System.groups[9].description: required");
  expect(err(parseDocument("a: 1\n", "x.txt")).startsWith("cannot parse x.txt: ")).toBe(true);
  expect(parseDocument("a: 1\n", "R.YML")).toStrictEqual({ ok: true, doc: { a: 1 } });
  expect(err(parseDocument("{\"a\": 1}\n", "r.yaml"))).toBe("<ok>");
});

test("§2.2: a thrown message is cut at its first newline", () => {
  const e = err(parseDocument("a: 1\nb: [\n", "x.yaml"));
  expect(e.startsWith("cannot parse x.yaml: ") && !e.includes("\n")).toBe(true);
  expect(err(parseDocument("7", "s.json"))).toBe("s.json is not a mapping at the top level");
});

test("§2.2: the types", () => {
  expectTypeOf(parseDocument).toEqualTypeOf<(text: string, name: string) => DocResult>();
  expectTypeOf(loadContour).toEqualTypeOf<(text: string, name: string) => LoadRecordResult>();
  expectTypeOf(loadMap).toEqualTypeOf<(text: string, name: string) => LoadMapResult>();
  expect(MAX_LISTED_PROBLEMS).toBe(20);
});
