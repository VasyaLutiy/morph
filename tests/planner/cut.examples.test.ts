import { test, expect } from "vitest";
import { fixture, fixtureJson } from "../helpers.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { cutUnits, cutComponent } from "../../src/planner/cut.js";
import { TYPESCRIPT, PYTHON } from "../../src/language/profiles.js";
import type { Component, ContourMap, ContourRecord } from "../../src/contour/types.js";
import type { CutInput } from "../../src/planner/types.js";

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

const cutIn = (over: Partial<CutInput>): CutInput => ({
  record: REC, component: LEDGER, map: MAP, docs: ["docs/TASK.md"], spec: "ledger.yaml", ...over,
});

test("Cut Units example 1: a group merges its Functions into one unit", () => {
  const groups = [{ name: "checks", functions: ["Sum Entries", "Check Ledger"] }];
  const r = cutUnits(LEDGER, groups);
  expect(r).toStrictEqual({
    ok: true,
    units: [
      { id: "parse-entry", name: "Parse Entry", functions: [LEDGER.functions[0]], isGroup: false },
      { id: "checks", name: "checks", functions: [LEDGER.functions[1], LEDGER.functions[2]], isGroup: true },
      { id: "format-report", name: "Format Report", functions: [LEDGER.functions[3]], isGroup: false },
    ],
  });
  if (r.ok) {
    expect(r.units[0].functions[0]).toBe(LEDGER.functions[0]);
    expect(r.units[1].functions[0]).toBe(LEDGER.functions[1]);
    expect(r.units[1].functions[1]).toBe(LEDGER.functions[2]);
    expect(r.units[2].functions[0]).toBe(LEDGER.functions[3]);
  }
});

test("Cut Units example 2: a group of another Component is skipped, record order kept", () => {
  const groups = [
    { name: "Other", functions: ["Count Words"] },
    { name: "Mixed Up", functions: ["Check Ledger", "Sum Entries"] },
  ];
  const r = cutUnits(LEDGER, groups);
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.units.map((u) => u.id)).toStrictEqual(["parse-entry", "mixed-up", "format-report"]);
    const group = r.units[1];
    expect(group.isGroup).toBe(true);
    expect(group.functions.length).toBe(2);
    expect(group.functions[0]).toBe(LEDGER.functions[1]);
    expect(group.functions[1]).toBe(LEDGER.functions[2]);
  }
});

test("Cut Units example 3: a group naming an unknown Function next to a known one fails", () => {
  const groups = [{ name: "bad", functions: ["Parse Entry", "Nope"] }];
  const r = cutUnits(LEDGER, groups);
  expect(r).toStrictEqual({
    ok: false,
    error:
      "group 'bad' names unknown Function 'Nope' next to 'Parse Entry' of Component 'ledger': " +
      "a group names the Functions of one Component",
  });
});

test("Cut Component example 1: the ledger cut equals ledger.cut.json", () => {
  const r = cutComponent(cutIn({}));
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.cuts.map((c) => c.card)).toStrictEqual(fixtureJson("planner/ledger.cut.json"));
    expect(r.cuts.map((c) => c.functions.map((f) => f.name))).toStrictEqual([
      ["Parse Entry"],
      ["Sum Entries", "Check Ledger"],
      ["Format Report"],
      [],
    ]);
    for (const cut of r.cuts) {
      expect(cut.slicedByMap).toBe(false);
      expect(cut.profile).toBe(TYPESCRIPT);
    }
    expect(r.cuts[0].card.customId).toBe("parse");
    expect(r.cuts[1].card.dependsOn).toStrictEqual(["parse"]);
    expect(r.cuts[1].card.variants).toBe(2);
    expect(r.cuts[2].card.instruction.startsWith("Write the report formatter.")).toBe(true);
    expect(r.cuts[2].card.dependsOn).toStrictEqual(["checks", "outside"]);
    expect(r.cuts[3].card.dependsOn).toStrictEqual(["format-report", "checks"]);
    expect(r.cuts[3].card.contextSlice).toStrictEqual([
      "docs/TASK.md",
      "src/ledger/formatReport.ts",
      "src/ledger/checks.ts",
    ]);
  }
});

test("Cut Component example 2: the store cut equals store.cut.json", () => {
  const r = cutComponent(cutIn({ component: STORE }));
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.cuts.map((c) => c.card)).toStrictEqual(fixtureJson("planner/store.cut.json"));
    expect(r.cuts[0].card.targets).toStrictEqual(["store/save_ledger.py", "tests/test_save_ledger.py"]);
    expect(r.cuts[0].card.dependsOn).toStrictEqual(["format-report"]);
    expect(r.cuts[0].card.contextSlice).toStrictEqual(["docs/TASK.md"]);
    expect(r.cuts[0].card.variants).toBe(3);
    expect(r.cuts[0].card.acceptance).toContain("pytest");
    for (const cut of r.cuts) {
      expect(cut.profile).toBe(PYTHON);
    }
  }
});

test("Cut Component example 3: the empty map cuts every Function on its own", () => {
  const r = cutComponent(cutIn({ map: EMPTY_MAP, docs: [] }));
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.cuts.map((c) => c.card.customId)).toStrictEqual([
      "parse-entry",
      "sum-entries",
      "check-ledger",
      "format-report",
      "ledger-cli",
    ]);
    expect(r.cuts.map((c) => c.card.dependsOn)).toStrictEqual([
      [],
      ["parse-entry"],
      ["parse-entry", "sum-entries"],
      ["sum-entries"],
      ["format-report", "check-ledger"],
    ]);
    expect(r.cuts[0].card.contextSlice).toStrictEqual(["src/ledger/parseEntry.ts"]);
    expect(r.cuts[1].card.contextSlice).toStrictEqual(["src/ledger/parseEntry.ts"]);
    for (const cut of r.cuts) {
      expect(cut.card.instruction.startsWith(
        "Every name you need is below -- the record `ledger.yaml` is cut",
      )).toBe(true);
    }
    expect(r.cuts[2].card.instruction).toContain("## Interface check API");
    expect(r.cuts.map((c) => c.card.maxTokens)).toStrictEqual([15000, 18500, 19000, 16500, 12000]);
  }
});

test("Cut Component example 4: every way the cut refuses", () => {
  const badLanguage = cutComponent(cutIn({ component: { ...LEDGER, language: "rust" } }));
  expect(badLanguage).toStrictEqual({
    ok: false,
    error: "Component 'ledger': unknown language 'rust' (known: typescript, python, go)",
  });

  const BAD = record("contour/badCalls.json");
  const LOOP = BAD.system.groups[0] as Component;
  const badCalls = cutComponent({
    record: BAD, component: LOOP, map: EMPTY_MAP, docs: [], spec: "x.yaml",
  });
  expect(badCalls).toStrictEqual({
    ok: false,
    error: "Function 'A' calls unknown Function 'B' of Component 'loop'",
  });

  const badInterface = cutComponent(cutIn({
    component: { ...LEDGER, interfaces: [{ name: "x", description: "d", exposes: ["Nope"] }] },
  }));
  expect(badInterface).toStrictEqual({
    ok: false,
    error: "Interface 'x' exposes unknown Function 'Nope'",
  });

  const badGroup = cutComponent(cutIn({
    map: { ...EMPTY_MAP, groups: [{ name: "parse-entry", functions: ["Sum Entries"] }] },
  }));
  expect(badGroup).toStrictEqual({ ok: false, error: "duplicate customId 'parse-entry'" });
});

test("a map card for an id this cut does not make is ignored", () => {
  const r = cutComponent(cutIn({}));
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.cuts.map((c) => c.card.customId)).not.toContain("count-words");
  }
});

test("an override's instruction replaces only the preamble", () => {
  const r = cutComponent(cutIn({}));
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.cuts[2].card.instruction.startsWith("Write the report formatter.")).toBe(true);
    expect(r.cuts[2].card.instruction).toContain("## Function Format Report");
  }
});

test("reasoning is always { maxTokens: 2500 } on a cut card", () => {
  const r = cutComponent(cutIn({}));
  expect(r.ok).toBe(true);
  if (r.ok) {
    for (const cut of r.cuts) {
      expect(cut.card.reasoning).toStrictEqual({ maxTokens: 2500 });
    }
  }
});

test("a dependency's slice entry is its final targets[0]", () => {
  const r = cutComponent(cutIn({ map: EMPTY_MAP, docs: [] }));
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.cuts[2].card.contextSlice).toStrictEqual([
      "src/ledger/parseEntry.ts",
      "src/ledger/sumEntries.ts",
    ]);
  }
});

test("intent defaults to patch on the empty map", () => {
  const r = cutComponent(cutIn({ map: EMPTY_MAP, docs: [] }));
  expect(r.ok).toBe(true);
  if (r.ok) {
    for (const cut of r.cuts) {
      expect(cut.card.intent).toBe("patch");
    }
  }
});
