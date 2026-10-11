import { test, expect } from "vitest";
import { cutJudges, judgeTarget } from "../../src/planner/judges.js";
import { TYPESCRIPT, PYTHON } from "../../src/language/profiles.js";
import { fixture, fixtureJson } from "../helpers.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import type { Card } from "../../src/cards/types.js";
import type { Component, ContourFunction, ContourMap, ContourRecord } from "../../src/contour/types.js";
import type { CutCard, JudgeInput } from "../../src/planner/types.js";
import type { LanguageProfile } from "../../src/language/types.js";

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

const helperHasFile = (path: string): boolean => path === "tests/helpers.ts";
const neverHasFile = (): boolean => false;

function input(over: Partial<JudgeInput>): JudgeInput {
  return {
    record: REC,
    cuts: CUTS,
    map: MAP,
    docs: ["docs/TASK.md"],
    defaultProfile: TYPESCRIPT,
    hasFile: helperHasFile,
    ...over,
  };
}

function byId(cards: readonly Card[], id: string): Card {
  const found = cards.find((c) => c.customId === id);
  if (found === undefined) throw new Error("no card " + id);
  return found;
}

test("Cut Judges example 1: the six judges of ledger then store equal ledger.judges.json", () => {
  const cards = cutJudges(input({}));
  expect(cards.map((c) => c.customId)).toStrictEqual([
    "parse-judge", "checks-judge", "format-report-judge",
    "ledger-cli-judge", "save-ledger-judge", "load-ledger-judge",
  ]);
  expect(cards).toStrictEqual(fixtureJson("planner/ledger.judges.json"));
});

test("Cut Judges example 2: checks-judge slice, budget, callee contract and preconditions", () => {
  const card = byId(cutJudges(input({})), "checks-judge");
  expect(card.contextSlice).toStrictEqual(["docs/TASK.md", "src/ledger/checks.ts", "tests/helpers.ts"]);
  expect(card.maxTokens).toBe(19000);
  expect(card.instruction).toContain(
    "Callee Parse Entry: One line of text into an Entry.\nBehaviour: Splits \"<name> <cents>\" at the last space; the cents are digits.",
  );
  expect(card.instruction.endsWith(
    "Preconditions a test's setup depends on:\n- ledger · Sum Entries · every line is parsed first, else Parse Entry faults before the sum\n- store · Save Ledger · the directory exists, else the write faults",
  )).toBe(true);
});

test("Cut Judges example 3: overridden parse-judge and ledger-cli-judge, python save-ledger-judge", () => {
  const cards = cutJudges(input({}));
  const parseJudge = byId(cards, "parse-judge");
  expect(parseJudge.dependsOn).toStrictEqual(["parse", "checks"]);
  expect(parseJudge.contextSlice).toStrictEqual(["docs/TASK.md"]);
  expect(parseJudge.maxTokens).toBe(30000);
  expect(parseJudge.targets).toStrictEqual(["tests/ledger/parse.examples.test.ts"]);
  const cliJudge = byId(cards, "ledger-cli-judge");
  expect(cliJudge.instruction).toBe("Write the CLI tests.");
  const saveJudge = byId(cards, "save-ledger-judge");
  expect(saveJudge.targets).toStrictEqual(["tests/test_save_ledger_examples.py"]);
  expect(saveJudge.contextSlice).toStrictEqual(["docs/TASK.md", "store/save_ledger.py"]);
});

test("Cut Judges example 4: the extra cards give the two judges of extras.judges.json", () => {
  const extras = fixtureJson("planner/extras.cards.json") as Card[];
  const cuts: CutCard[] = extras.map((card) => ({
    card, component: null, profile: null, functions: [], slicedByMap: true,
  }));
  const cards = cutJudges(input({ cuts, map: EMPTY_MAP, hasFile: neverHasFile }));
  expect(cards.map((c) => c.customId)).toStrictEqual(["store-schema-judge", "ledger-types-judge"]);
  const schemaJudge = byId(cards, "store-schema-judge");
  expect(schemaJudge.targets).toStrictEqual(["tests/test_schema_examples.py"]);
  expect(schemaJudge.maxTokens).toBe(16000);
  expect(cards).toStrictEqual(fixtureJson("planner/extras.judges.json"));
});

test("own: judgeTarget takes the component from the code target's directory name", () => {
  expect(judgeTarget(TYPESCRIPT, "src/bare.ts")).toBe("tests/src/bare.examples.test.ts");
});

test("own: judgeTarget of a python code target", () => {
  expect(judgeTarget(PYTHON, "store/save_ledger.py")).toBe("tests/test_save_ledger_examples.py");
});

test("own: the examples line names the first Function of the cut", () => {
  const card = byId(cutJudges(input({})), "checks-judge");
  expect(card.instruction).toContain(
    "The examples below are the criterion, and you are its independent author: write one test per example (no fewer, no merging), each named after the Function and the example number, e.g. \"Sum Entries example 1\".",
  );
});
