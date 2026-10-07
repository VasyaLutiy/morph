import { fixture } from "../helpers.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import {
  codeBudget,
  dataBlocks,
  functionSection,
  inheritedSection,
  interfaceSection,
  judgeBudget,
  preamble,
  renderExamples,
} from "../../src/planner/render.js";
import type { Component, ContourFunction, ContourMap, ContourRecord, Example } from "../../src/contour/types.js";
import { expect, test } from "vitest";

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

const fn = (c: Component, n: string): ContourFunction =>
  c.functions.find((f) => f.name === n) as ContourFunction;

test("Render Examples example 1: whitespace is collapsed in given, when, then and ref", () => {
  const examples: Example[] = [
    { given: "the line \"rent 1200\"", when: "parsed", then: "{name: \"rent\", cents: 1200}", ref: null },
    { given: "a b\n c", when: " w ", then: "t", ref: "R 1" },
  ];
  expect(renderExamples(examples)).toBe(
    "1. given the line \"rent 1200\"; when parsed; then {name: \"rent\", cents: 1200}\n" +
      "2. given a b c; when w; then t (ref: R 1)",
  );
});

test("Render Examples example 2: no examples render to the empty string", () => {
  expect(renderExamples([])).toBe("");
});

test("Render Function example 1: functionSection of Sum Entries matches the fixture", () => {
  expect(functionSection(REC, fn(LEDGER, "Sum Entries"))).toBe(
    fixture("planner/sumEntries.section.txt"),
  );
});

test("Render Function example 2: functionSection of Check Ledger matches the fixture and ends with the missing definition", () => {
  const section = functionSection(REC, fn(LEDGER, "Check Ledger"));
  expect(section).toBe(fixture("planner/checkLedger.section.txt"));
  const lines = section.split("\n");
  expect(lines[lines.length - 1]).toBe("- Unknown Rule (definition not found in the record)");
});

test("Render Function example 3: dataBlocks of store finds Ledger File and Entry of another Component", () => {
  const functions = [fn(STORE, "Save Ledger"), fn(STORE, "Load Ledger")];
  expect(dataBlocks(REC, functions)).toStrictEqual([
    "Data Ledger File: A text file of entries.\nSchema:\n{\n  \"path\": \"string\",\n  \"text\": \"string\"\n}",
    "Data Entry: One ledger entry.\nSchema:\n{ name: string, cents: number }",
  ]);
});

test("Render Context example 1: preamble with and without docs", () => {
  expect(preamble(["docs/A.md", "docs/B.md"], "c.yaml")).toBe(
    "Read docs/A.md, docs/B.md FIRST (in your context). Every name you need is in them or below; do not invent names, keys or files.",
  );
  expect(preamble([], "c.yaml")).toBe(
    "Every name you need is below -- the record `c.yaml` is cut into this instruction; do not invent names, keys or files.",
  );
});

test("Render Context example 2: inheritedSection of ledger merges System and Component", () => {
  expect(inheritedSection(REC, LEDGER)).toBe(
    "## Component requirements / guardrails\n\nRequirements:\n- Exact Sums: Sums are integers of cents, never floats.\n\nGuardrails:\n- No Network: Nothing opens a socket.\n- Pure Core: No clock and no file system in the core.",
  );
});

test("Render Context example 3: no requirements and no guardrails give the empty string", () => {
  const emptied: ContourRecord = {
    ...REC,
    system: { ...REC.system, requirements: [], guardrails: [] },
  };
  expect(inheritedSection(emptied, STORE)).toBe("");
});

test("Render Context example 4: interfaceSection lists each exposed Function with its module", () => {
  const iface = LEDGER.interfaces.find((i) => i.name === "ledger CLI");
  if (iface === undefined) throw new Error("interface ledger CLI not found");
  expect(interfaceSection(iface, ["src/a.ts", "src/b.ts"])).toBe(
    "## Interface ledger CLI\n\nThe command line.\n\nExposes:\n- Format Report (`src/a.ts`)\n- Check Ledger (`src/b.ts`)",
  );
});

test("Card Budget example 1: codeBudget by steps, members, group and examples", () => {
  expect(codeBudget(6, 2, true, 3)).toStrictEqual({
    maxTokens: 29500,
    reasoningMaxTokens: 2500,
    variants: 2,
  });
  expect(codeBudget(1, 1, false, 2)).toStrictEqual({
    maxTokens: 15000,
    reasoningMaxTokens: 2500,
    variants: 1,
  });
  expect(codeBudget(3, 1, false, 0)).toStrictEqual({
    maxTokens: 18000,
    reasoningMaxTokens: 2500,
    variants: 2,
  });
});

test("Card Budget example 2: the cap on codeBudget and judgeBudget", () => {
  expect(codeBudget(20, 3, true, 10).maxTokens).toBe(32000);
  expect(judgeBudget(4)).toStrictEqual({
    maxTokens: 20000,
    reasoningMaxTokens: 2500,
    variants: 1,
  });
  expect(judgeBudget(12).maxTokens).toBe(28000);
  expect(judgeBudget(20).maxTokens).toBe(32000);
});

test("own: the loaded map and the empty map are as the skeleton says", () => {
  expect(MAP.docs).toStrictEqual(["docs/TASK.md", "ledger.yaml"]);
  expect(EMPTY_MAP.docs).toStrictEqual([]);
  expect(EMPTY_MAP.cards).toStrictEqual([]);
});

test("own: the examples heading and the constants are the record's", () => {
  expect(functionSection(REC, fn(LEDGER, "Sum Entries"))).toContain(
    "Examples (the tests must prove each one):",
  );
  expect(codeBudget(20, 3, true, 10).maxTokens).toBe(32000);
});

test("own: dataBlocks names each Data Object once whatever the steps repeat", () => {
  const save = fn(STORE, "Save Ledger");
  const blocks = dataBlocks(REC, [save, save]);
  expect(blocks.length).toBe(1);
  expect(blocks[0]).toContain("Data Ledger File: A text file of entries.");
});

test("own: a step target that is no Data Object yields no block", () => {
  const check = fn(LEDGER, "Check Ledger");
  expect(dataBlocks(REC, [check])).toStrictEqual([]);
});

test("own: renderExamples numbers examples from 1", () => {
  const examples: Example[] = [
    { given: "g1", when: "w1", then: "t1", ref: null },
    { given: "g2", when: "w2", then: "t2", ref: null },
    { given: "g3", when: "w3", then: "t3", ref: null },
  ];
  const lines = renderExamples(examples).split("\n");
  expect(lines.length).toBe(3);
  expect(lines[0].startsWith("1. ")).toBe(true);
  expect(lines[1].startsWith("2. ")).toBe(true);
  expect(lines[2].startsWith("3. ")).toBe(true);
});
