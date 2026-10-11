import { test, expect } from "vitest";
import { parseDocument, loadContour, loadMap } from "../../src/contour/load.js";
import { fixture, fixtureJson } from "../helpers.js";

test("Parse Document example 1: yaml and json text become one doc each", () => {
  expect(parseDocument("a: 1\nb: [x, y]\n", "r.yaml")).toStrictEqual({
    ok: true,
    doc: { a: 1, b: ["x", "y"] },
  });
  expect(parseDocument("{\"a\": [1, \"2\"]}", "m.JSON")).toStrictEqual({
    ok: true,
    doc: { a: [1, "2"] },
  });
});

test("Parse Document example 2: a parse failure is a one-line error with the name", () => {
  const r1 = parseDocument("a: 1\n", "m.json");
  expect(r1.ok).toBe(false);
  if (!r1.ok) {
    expect(r1.error.startsWith("cannot parse m.json: ")).toBe(true);
    expect(r1.error.includes("\n")).toBe(false);
  }
  const r2 = parseDocument("a: 1\na: 2\n", "d.yml");
  expect(r2.ok).toBe(false);
  if (!r2.ok) {
    expect(r2.error.startsWith("cannot parse d.yml: ")).toBe(true);
    expect(r2.error.includes("\n")).toBe(false);
  }
});

test("Parse Document example 3: a non-mapping top level is rejected with its name", () => {
  expect(parseDocument("- a\n- b\n", "r.yaml")).toStrictEqual({
    ok: false,
    error: "r.yaml is not a mapping at the top level",
  });
  expect(parseDocument("", "e.yaml")).toStrictEqual({
    ok: false,
    error: "e.yaml is not a mapping at the top level",
  });
  expect(parseDocument("null", "n.json")).toStrictEqual({
    ok: false,
    error: "n.json is not a mapping at the top level",
  });
});

test("Load Spec example 1: the mini yaml loads to the typed record", () => {
  expect(loadContour(fixture("contour/mini.yaml"), "mini.yaml")).toStrictEqual({
    ok: true,
    record: fixtureJson("contour/mini.typed.json"),
  });
});

test("Load Spec example 2: a bad record and a bad map list their problems", () => {
  expect(loadContour(fixture("contour/badRecord.json"), "badRecord.json")).toStrictEqual({
    ok: false,
    error:
      "badRecord.json is not a valid record (19 problems):\n" +
      (fixtureJson("contour/badRecord.problems.json") as string[]).join("\n"),
  });
  expect(loadMap(fixture("contour/badMap.json"), "badMap.json")).toStrictEqual({
    ok: false,
    error:
      "badMap.json is not a valid map (15 problems):\n" +
      (fixtureJson("contour/badMap.problems.json") as string[]).join("\n"),
  });
});

test("Load Spec example 3: many problems are cut at twenty, one is singular, a bad parse surfaces", () => {
  const many = JSON.stringify({
    System: { name: "s", description: "d", groups: Array.from({ length: 11 }, () => ({})) },
  });
  const problems: string[] = [];
  for (let i = 0; i < 11; i++) {
    problems.push("System.groups[" + i + "].name: required");
    problems.push("System.groups[" + i + "].description: required");
  }
  const expected =
    "many.json is not a valid record (22 problems):\n" +
    problems.slice(0, 20).join("\n") +
    "\n… and 2 more";
  expect(loadContour(many, "many.json")).toStrictEqual({ ok: false, error: expected });
  expect(
    loadContour("{\"System\": {\"name\": \"s\", \"description\": \"d\"}}", "one.json"),
  ).toStrictEqual({
    ok: false,
    error: "one.json is not a valid record (1 problem):\nSystem.groups: required",
  });
  const r = loadMap("a: [", "m.yaml");
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.startsWith("cannot parse m.yaml: ")).toBe(true);
});

test("Load Spec example 4: this repository's own spec and map load", () => {
  const rec = loadContour(fixture("../../contour.yaml"), "contour.yaml");
  expect(rec.ok).toBe(true);
  if (rec.ok) {
    expect(rec.record.system.name).toBe("MorphV2");
    const contour = rec.record.system.groups.find((c) => c.name === "contour");
    expect(contour).toBeDefined();
    if (contour !== undefined) {
      for (const f of contour.functions) {
        expect(f.examples.length >= 1).toBe(true);
      }
    }
    for (const g of rec.record.system.groups) {
      for (const f of g.functions) {
        expect(f.examples.length >= 1).toBe(true);
      }
    }
  }
  const map = loadMap(fixture("../../morph-map.json"), "morph-map.json");
  expect(map.ok).toBe(true);
  if (map.ok) {
    expect(map.map.package).toBe("src");
    expect(map.map.cards.some((c) => c.id === "validate-record")).toBe(true);
  }
});

test("Load Spec: a name with an uppercase .YML extension is parsed as yaml", () => {
  const r = parseDocument("version: 1\n", "x.YML");
  expect(r.ok ? r.doc : null).toStrictEqual({ version: 1 });
});

test("Load Spec: a map failure returns the parse error unchanged", () => {
  const rec = loadContour("{", "m.json");
  const map = loadMap("{", "m.json");
  expect(rec.ok).toBe(false);
  expect(map.ok).toBe(false);
  if (!rec.ok && !map.ok) expect(rec.error).toBe(map.error);
});

test("Load Spec: exactly twenty problems are listed in full with no tail line", () => {
  const doc = { System: { name: "s", description: "d", groups: Array.from({ length: 10 }, () => ({})) } };
  const r = loadContour(JSON.stringify(doc), "just.json");
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.error.endsWith("… and 0 more")).toBe(false);
    const lines = r.error.split("\n");
    expect(lines.length).toBe(1 + 20);
    expect(lines[0]).toBe("just.json is not a valid record (20 problems):");
  }
});

test("Load Spec: a non-object doc does not reach the validator", () => {
  expect(loadContour("[1]", "arr.json")).toStrictEqual({
    ok: false,
    error: "arr.json is not a mapping at the top level",
  });
  expect(loadMap("42", "num.yaml")).toStrictEqual({
    ok: false,
    error: "num.yaml is not a mapping at the top level",
  });
});
