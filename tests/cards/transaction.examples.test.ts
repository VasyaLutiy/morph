import { expect, test } from "vitest";
import { TRANSACTION_MARK, blameLog, isTransactionDeck } from "../../src/cards/transaction.js";
import { TREE_PROFILES } from "../../src/language/treeProfiles.js";
import { fixtureJson } from "../helpers.js";
import type { Card } from "../../src/cards/types.js";

const logs = (): Record<string, string> => fixtureJson("cards/blameLogs.json") as Record<string, string>;
const FL: string[] = TREE_PROFILES.map((p) => p.fileLine);
const on = (list: string[]) => (p: string): boolean => list.includes(p);
const c = (acceptance: string | null): Card => ({
  customId: "a",
  intent: "generate",
  targets: ["x.ts"],
  contextSlice: [],
  instruction: "i",
  acceptance,
  model: null,
  maxTokens: null,
  reasoning: null,
  variants: 1,
  dependsOn: [],
});

test("Transaction Deck example 1: the mark as a first line makes the deck a transaction", () => {
  const marked: Card[] = [{ ...c(TRANSACTION_MARK + "\nexit 0") }, { ...c(null), customId: "b" }];
  const plain: Card[] = [{ ...c("exit 0") }, { ...c(null), customId: "b" }];
  expect(isTransactionDeck(marked)).toBe(true);
  expect(isTransactionDeck(plain)).toBe(false);
  expect(isTransactionDeck([])).toBe(false);
});

test("Transaction Deck example 2: only a first line equal to the mark counts", () => {
  expect(isTransactionDeck([c(TRANSACTION_MARK)])).toBe(false);
  expect(isTransactionDeck([c(" " + TRANSACTION_MARK + "\nexit 0")])).toBe(false);
  expect(isTransactionDeck([c("exit 0\n" + TRANSACTION_MARK + "\n")])).toBe(false);
});

test("Blame Log example 1: a Go log blames the owners, a gone probe and an outside file", () => {
  const owners: Record<string, string> = {
    "rate/rate.go": "k7",
    "pump/flow.go": "p2",
    "rate/rate_examples_test.go": "kj",
  };
  expect(blameLog(logs().go, "k7", owners, FL, on(["cmd/tool/main.go", "pump/flow.go", "rate/rate.go"])))
    .toStrictEqual({
      cards: ["k7", "p2"],
      outside: ["cmd/tool/main.go:6:2: m.Old undefined (type *rate.Meter has no field or method Old)"],
    });
  const owners2: Record<string, string> = { "rate/rate.go": "k7", "pump/flow.go": "p2" };
  expect(blameLog(logs().go, "k7", owners2, FL, on([]))).toStrictEqual({ cards: ["k7", "p2"], outside: [] });
});

test("Blame Log example 2: a TypeScript log trims trailing spaces and lists a duplicate once", () => {
  const owners: Record<string, string> = {
    "src/units/len.ts": "w3",
    "src/report/total.ts": "rt",
    "tests/report/total.examples.test.ts": "rtj",
  };
  const paths = ["src/units/len.ts", "src/report/total.ts", "tests/report/total.examples.test.ts"];
  expect(blameLog(logs().typescript, "w3", owners, FL, on(paths)))
    .toStrictEqual({ cards: ["rt", "rtj", "w3"], outside: [] });
  expect(blameLog(logs().typescript, "rt", { "src/report/total.ts": "rt" }, FL, () => true)).toStrictEqual({
    cards: ["rt"],
    outside: [
      "probe/w3/w3.probe.ts(2,10): error TS2305: Module '\"../../src/units/len.js\"' has no exported member 'toYards'.",
      "src/units/len.ts(9,3): error TS1005: ';' expected.",
      "tests/report/total.examples.test.ts(5,44): error TS2554: Expected 3 arguments, but got 2.",
    ],
  });
});

test("Blame Log example 3: no named file blames the card itself", () => {
  const owners: Record<string, string> = { "src/a.ts": "q" };
  expect(blameLog(logs().none, "n4", owners, FL, () => true)).toStrictEqual({ cards: ["n4"], outside: [] });
  expect(blameLog("", "n4", owners, FL, () => true)).toStrictEqual({ cards: ["n4"], outside: [] });
  expect(blameLog("src/a.ts(1,1): error TS1: x\n", "z", owners, FL, () => true))
    .toStrictEqual({ cards: ["q"], outside: [] });
  expect(blameLog(logs().go, "k7", {}, [], () => true)).toStrictEqual({ cards: ["k7"], outside: [] });
});

test("Blame Log example 4: with Python and Go patterns every Go line but the owner goes outside", () => {
  expect(blameLog(logs().go, "k7", { "pump/flow.go": "p2" }, FL.slice(1), () => true)).toStrictEqual({
    cards: ["p2"],
    outside: [
      "cmd/tool/main.go:6:2: m.Old undefined (type *rate.Meter has no field or method Old)",
      "rate/k7_probe_test.go:9:2: undefined: rate.Mid",
      "rate/rate.go:3:1: missing return",
    ],
  });
});

test("Transaction Deck: the cards are left unchanged", () => {
  const cards: Card[] = [{ ...c(TRANSACTION_MARK + "\nexit 0") }, { ...c(null), customId: "b" }];
  const before = JSON.parse(JSON.stringify(cards)) as Card[];
  expect(isTransactionDeck(cards)).toBe(true);
  expect(cards).toStrictEqual(before);
});

test("Transaction Deck: an empty deck and a bare acceptance are not transactions", () => {
  expect(isTransactionDeck([])).toBe(false);
  expect(isTransactionDeck([c("")])).toBe(false);
});

test("Blame Log: a line starting with '#' or a tab is skipped", () => {
  const log = "\tprobe/w3/w3.probe.ts(2,10): error TS2305: x\n# rate/rate.go:3:1: missing return\n";
  expect(blameLog(log, "a", {}, FL, () => true)).toStrictEqual({ cards: ["a"], outside: [] });
});

test("Blame Log: the owners map is left unchanged and a card is named once", () => {
  const owners: Record<string, string> = { "src/report/total.ts": "rt" };
  const log = "src/report/total.ts(4,21): error TS1: x\nsrc/report/total.ts(4,21): error TS2: y\n";
  expect(blameLog(log, "w3", owners, FL, () => true)).toStrictEqual({ cards: ["rt"], outside: [] });
  expect(owners).toStrictEqual({ "src/report/total.ts": "rt" });
});

test("Blame Log: two outside lines of one file are listed separately, sorted", () => {
  const log =
    "src/report/total.ts(1,1): error TS1: a\nsrc/units/len.ts(9,3): error TS2: b\nsrc/report/total.ts(1,1): error TS3: c\n";
  expect(blameLog(log, "z", {}, FL, () => true)).toStrictEqual({
    cards: [],
    outside: [
      "src/report/total.ts(1,1): error TS1: a",
      "src/report/total.ts(1,1): error TS3: c",
      "src/units/len.ts(9,3): error TS2: b",
    ],
  });
});
