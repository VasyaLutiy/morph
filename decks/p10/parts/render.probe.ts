// P10a probe for render: renderExamples, dataBlocks, functionSection, preamble, inheritedSection,
// interfaceSection, codeBudget, judgeBudget by docs/TASK_P10a_planner.md §2.2, one test per record example
// (Component planner: Render Examples 1-2, Render Function 1-3, Render Context 1-4, Card Budget 1-2), then the
// §2.2 rows and the types. The harness is §2.1's, verbatim.
import { test, expect, expectTypeOf } from "vitest";
import {
  EXAMPLES_HEADING, MAX_TOKENS_CAP, REASONING_MAX_TOKENS, codeBudget, dataBlocks, functionSection,
  inheritedSection, interfaceSection, judgeBudget, preamble, renderExamples,
} from "../../src/planner/render.js";
import type { Budget, CutCard, Plan, Unit } from "../../src/planner/types.js";
import type { Card } from "../../src/cards/types.js";
import type { Component, ContourFunction, ContourInterface, ContourMap, ContourRecord } from "../../src/contour/types.js";
import type { LanguageProfile } from "../../src/language/types.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { fixture } from "../../tests/helpers.js";

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
const fn = (c: Component, name: string): ContourFunction => {
  const f = c.functions.find((x) => x.name === name);
  if (f === undefined) throw new Error("no Function " + name);
  return f;
};

test("Render Examples example 1: one line per example, whitespace collapsed, ref last", () => {
  expect(renderExamples([
    { given: 'the line "rent 1200"', when: "parsed", then: '{name: "rent", cents: 1200}', ref: null },
    { given: "a  b\n c", when: " w ", then: "t", ref: "R  1" },
  ])).toBe('1. given the line "rent 1200"; when parsed; then {name: "rent", cents: 1200}\n2. given a b c; when w; then t (ref: R 1)');
});

test("Render Examples example 2: no examples", () => {
  expect(renderExamples([])).toBe("");
});

test("Render Function example 1: Sum Entries, the whole section", () => {
  expect(functionSection(REC, fn(LEDGER, "Sum Entries"))).toBe(fixture("planner/sumEntries.section.txt"));
});

test("Render Function example 2: Check Ledger, an undefined requirement", () => {
  const s = functionSection(REC, fn(LEDGER, "Check Ledger"));
  expect(s).toBe(fixture("planner/checkLedger.section.txt"));
  expect(s.endsWith("\n- Unknown Rule (definition not found in the record)")).toBe(true);
});

test("Render Function example 3: dataBlocks over two Functions, a Data Object of another Component", () => {
  expect(dataBlocks(REC, STORE.functions)).toStrictEqual([
    'Data Ledger File: A text file of entries.\nSchema:\n{\n  "path": "string",\n  "text": "string"\n}',
    "Data Entry: One ledger entry.\nSchema:\n{ name: string, cents: number }",
  ]);
});

test("Render Context example 1: preamble with and without docs", () => {
  expect(preamble(["docs/A.md", "docs/B.md"], "c.yaml")).toBe(
    "Read docs/A.md, docs/B.md FIRST (in your context). Every name you need is in them or below; do not invent names, keys or files.");
  expect(preamble([], "c.yaml")).toBe(
    "Every name you need is below -- the record `c.yaml` is cut into this instruction; do not invent names, keys or files.");
});

test("Render Context example 2: inherited, System then Component, distinct", () => {
  expect(inheritedSection(REC, LEDGER)).toBe(
    "## Component requirements / guardrails\n\nRequirements:\n- Exact Sums: Sums are integers of cents, never floats.\n\n" +
    "Guardrails:\n- No Network: Nothing opens a socket.\n- Pure Core: No clock and no file system in the core.");
});

test("Render Context example 3: nothing inherited", () => {
  const bare: ContourRecord = { ...REC, system: { ...REC.system, requirements: [], guardrails: [] } };
  expect(inheritedSection(bare, STORE)).toBe("");
});

test("Render Context example 4: an Interface section", () => {
  const cli = LEDGER.interfaces[0] as ContourInterface;
  expect(interfaceSection(cli, ["src/a.ts", "src/b.ts"])).toBe(
    "## Interface ledger CLI\n\nThe command line.\n\nExposes:\n- Format Report (`src/a.ts`)\n- Check Ledger (`src/b.ts`)");
});

test("Card Budget example 1: the code formula", () => {
  expect(codeBudget(6, 2, true, 3)).toStrictEqual({ maxTokens: 29500, reasoningMaxTokens: 2500, variants: 2 });
  expect(codeBudget(1, 1, false, 2)).toStrictEqual({ maxTokens: 15000, reasoningMaxTokens: 2500, variants: 1 });
  expect(codeBudget(3, 1, false, 0)).toStrictEqual({ maxTokens: 18000, reasoningMaxTokens: 2500, variants: 2 });
});

test("Card Budget example 2: the cap and the judge formula", () => {
  expect(codeBudget(20, 3, true, 10).maxTokens).toBe(32000);
  expect(judgeBudget(4)).toStrictEqual({ maxTokens: 20000, reasoningMaxTokens: 2500, variants: 1 });
  expect(judgeBudget(12).maxTokens).toBe(28000);
  expect(judgeBudget(20).maxTokens).toBe(32000);
});

test("§2.2: constants, a section without preconditions and steps, a schema-less Data Object", () => {
  expect(EXAMPLES_HEADING).toBe("Examples (the tests must prove each one):");
  expect(MAX_TOKENS_CAP).toBe(32000);
  expect(REASONING_MAX_TOKENS).toBe(2500);
  const f: ContourFunction = { name: "F", description: "D.", behavior: "B.", requirements: [], guardrails: ["No Network"],
    preconditions: [], steps: [], examples: [{ given: "g", when: "w", then: "t", ref: null }] };
  expect(functionSection(REC, f)).toBe(
    "## Function F\n\nD.\n\nBehaviour: B.\n\nExamples (the tests must prove each one):\n1. given g; when w; then t\n\nGuardrails:\n- No Network: Nothing opens a socket.");
  const r2: ContourRecord = { ...REC, system: { ...REC.system, groups: [{ ...STORE, dataObjects: [{ name: "Ledger File", description: "L.", schema: null }] }] } };
  expect(dataBlocks(r2, STORE.functions)).toStrictEqual(["Data Ledger File: L."]);
  expect(codeBudget(0, 1, false, 0)).toStrictEqual({ maxTokens: 12000, reasoningMaxTokens: 2500, variants: 1 });
  expect(judgeBudget(0).maxTokens).toBe(16000);
});

test("§2.2: the types of src/planner/types.ts", () => {
  expectTypeOf<Budget>().toEqualTypeOf<{ maxTokens: number; reasoningMaxTokens: number; variants: number }>();
  expectTypeOf<Unit>().toEqualTypeOf<{ id: string; name: string; functions: ContourFunction[]; isGroup: boolean }>();
  expectTypeOf<CutCard>().toEqualTypeOf<{
    card: Card; component: Component | null; profile: LanguageProfile | null; functions: ContourFunction[]; slicedByMap: boolean;
  }>();
  expectTypeOf<Plan>().toEqualTypeOf<{
    spec: string; components: string[]; cards: Card[]; generations: string[][]; externalDependsOn: Record<string, string[]>;
  }>();
  expect(MAP.docs).toStrictEqual(["docs/TASK.md", "ledger.yaml"]);
});
