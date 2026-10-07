// P10a probe for cut-judges: cutJudges, judgeTarget by docs/TASK_P10a_planner.md §2.2, one test per record
// example (Component planner: Cut Judges 1-4), then the §2.2 rows and the types. The harness is §2.1's,
// verbatim; the Cut Cards are built from the cut fixtures (what cutComponent gives, Cut Judges' precondition),
// so this card does not wait for cut-component.
import { test, expect, expectTypeOf } from "vitest";
import { cutJudges, judgeTarget } from "../../src/planner/judges.js";
import type { CutCard, JudgeInput } from "../../src/planner/types.js";
import type { Card } from "../../src/cards/types.js";
import type { Component, ContourFunction, ContourMap, ContourRecord } from "../../src/contour/types.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { PYTHON, TYPESCRIPT } from "../../src/language/profiles.js";
import type { LanguageProfile } from "../../src/language/types.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

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
const fns = (c: Component, names: string[]): ContourFunction[] =>
  names.map((n) => c.functions.find((f) => f.name === n) as ContourFunction);
const [P, K, R, L] = fixtureJson("planner/ledger.cut.json") as Card[];
const [S, D] = fixtureJson("planner/store.cut.json") as Card[];
const cut = (card: Card | undefined, component: Component, profile: LanguageProfile, names: string[]): CutCard =>
  ({ card: card as Card, component, profile, functions: fns(component, names), slicedByMap: false });
const CUTS: CutCard[] = [
  cut(P, LEDGER, TYPESCRIPT, ["Parse Entry"]), cut(K, LEDGER, TYPESCRIPT, ["Sum Entries", "Check Ledger"]),
  cut(R, LEDGER, TYPESCRIPT, ["Format Report"]), cut(L, LEDGER, TYPESCRIPT, []),
  cut(S, STORE, PYTHON, ["Save Ledger"]), cut(D, STORE, PYTHON, ["Load Ledger"]),
];
const helpersOnly = (p: string): boolean => p === "tests/helpers.ts";
const input = (over: Partial<JudgeInput>): JudgeInput => ({
  record: REC, cuts: CUTS, map: MAP, docs: ["docs/TASK.md"], defaultProfile: TYPESCRIPT, hasFile: helpersOnly, ...over });
const byId = (cs: Card[], id: string): Card | undefined => cs.find((c) => c.customId === id);

test("Cut Judges example 1: the six judges of ledger and store", () => {
  expect(cutJudges(input({}))).toStrictEqual(fixtureJson("planner/ledger.judges.json"));
});

test("Cut Judges example 2: checks-judge carries the callee and the preconditions", () => {
  const j = byId(cutJudges(input({})), "checks-judge");
  expect(j?.contextSlice).toStrictEqual(["docs/TASK.md", "src/ledger/checks.ts", "tests/helpers.ts"]);
  expect(j?.maxTokens).toBe(19000);
  expect(j?.instruction.includes(
    'Callee Parse Entry: One line of text into an Entry.\nBehaviour: Splits "<name> <cents>" at the last space; the cents are digits.')).toBe(true);
  expect(j?.instruction.endsWith(
    "Preconditions a test's setup depends on:\n- ledger · Sum Entries · every line is parsed first, else Parse Entry faults before the sum\n" +
    "- store · Save Ledger · the directory exists, else the write faults")).toBe(true);
});

test("Cut Judges example 3: overridden judges and a python judge", () => {
  const js = cutJudges(input({}));
  const p = byId(js, "parse-judge");
  expect(p?.dependsOn).toStrictEqual(["parse", "checks"]);
  expect(p?.contextSlice).toStrictEqual(["docs/TASK.md"]);
  expect(p?.maxTokens).toBe(30000);
  expect(p?.targets).toStrictEqual(["tests/ledger/parse.examples.test.ts"]);
  expect(byId(js, "ledger-cli-judge")?.instruction).toBe("Write the CLI tests.");
  const s = byId(js, "save-ledger-judge");
  expect(s?.targets).toStrictEqual(["tests/test_save_ledger_examples.py"]);
  expect(s?.contextSlice).toStrictEqual(["docs/TASK.md", "store/save_ledger.py"]);
});

test("Cut Judges example 4: judges of extra cards, by extension", () => {
  const extras = (fixtureJson("planner/extras.cards.json") as Card[]).map(
    (card): CutCard => ({ card, component: null, profile: null, functions: [], slicedByMap: true }));
  const js = cutJudges(input({ cuts: extras, hasFile: () => false }));
  expect(js).toStrictEqual(fixtureJson("planner/extras.judges.json"));
  expect(js.map((c) => c.customId)).toStrictEqual(["store-schema-judge", "ledger-types-judge"]);
  expect(byId(js, "store-schema-judge")?.targets).toStrictEqual(["tests/test_schema_examples.py"]);
  expect(byId(js, "store-schema-judge")?.maxTokens).toBe(16000);
});

test("§2.2: judgeTarget, the opening, the default profile, the examples block", () => {
  expect(judgeTarget(TYPESCRIPT, "src/tally/countWords.ts")).toBe("tests/tally/countWords.examples.test.ts");
  expect(judgeTarget(PYTHON, "pkg/a.py")).toBe("tests/test_a_examples.py");
  const js = cutJudges(input({}));
  const f = byId(js, "format-report-judge");
  expect(f?.instruction.startsWith("Write ONLY the test file `tests/ledger/formatReport.examples.test.ts`: one test per example of `src/ledger/formatReport.ts` taken from docs/TASK.md, this instruction")).toBe(true);
  expect(f?.instruction.includes(
    '\n\nThe examples below are the criterion, and you are its independent author: write one test per example (no fewer, no merging), each named after the Function and the example number, e.g. "Format Report example 1".\n\nExamples of Function Format Report:\n1. given the entry rent 1200; when formatted; then "rent 1200\\ntotal 1200\\n"')).toBe(true);
  expect(f?.dependsOn).toStrictEqual(["format-report"]);
  expect(f?.acceptance?.startsWith("D=/tmp/morph/format-report-judge; mkdir -p $D;")).toBe(true);
  expect(f?.variants).toBe(1);
  expect(f?.intent).toBe("patch");
  const notes: Card = { customId: "n", intent: "patch", targets: ["lib/n.py"], contextSlice: [], instruction: "x", acceptance: null,
    model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: [] };
  const viaDefault = cutJudges(input({ cuts: [{ card: { ...notes, targets: ["lib/n.mjs"] }, component: null, profile: null, functions: [], slicedByMap: true }], defaultProfile: PYTHON }));
  expect(viaDefault).toStrictEqual([]);
  const selfUse: Component = { ...LEDGER, functions: LEDGER.functions.map((x) =>
    (x.name === "Parse Entry" ? { ...x, steps: [...x.steps, { verb: "uses" as const, target: "Ledger" }] } : x)) };
  const own = cutJudges(input({ record: { ...REC, system: { ...REC.system, groups: [selfUse, STORE] } },
    cuts: [cut(P, selfUse, TYPESCRIPT, ["Parse Entry"])] }));
  expect(own[0]?.instruction.includes("Preconditions")).toBe(false);
  const viaExt = cutJudges(input({ cuts: [{ card: notes, component: null, profile: null, functions: [], slicedByMap: true }] }));
  expect(viaExt[0]?.targets).toStrictEqual(["tests/test_n_examples.py"]);
});

test("§2.2: the types", () => {
  expectTypeOf(cutJudges).returns.toEqualTypeOf<Card[]>();
  expectTypeOf<JudgeInput>().toEqualTypeOf<{
    record: ContourRecord; cuts: CutCard[]; map: ContourMap; docs: string[];
    defaultProfile: LanguageProfile; hasFile: (path: string) => boolean;
  }>();
});
