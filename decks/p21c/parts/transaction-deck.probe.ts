// P21c probe for transaction-deck by docs/TASK_P21c_transaction.md §2.2 (src/cards/transaction.ts) — the mark of a subset
// transaction deck and the blame of a red acceptance log by the files its lines name (issue #12, comment 6077766447: the
// patterns are Tree Profiles' data, nothing names a language). Record Transaction Deck 1-2 and Blame Log 1-4, then rows.
import { test, expect } from "vitest";
import { TRANSACTION_MARK, isTransactionDeck, blameLog } from "../../src/cards/transaction.js";
import type { Blame } from "../../src/cards/transaction.js";
import { TREE_PROFILES } from "../../src/language/treeProfiles.js";
import type { Card } from "../../src/cards/types.js";
import { fixtureJson } from "../../tests/helpers.js";

const logs = (): Record<string, string> => fixtureJson("cards/blameLogs.json") as Record<string, string>;
const FL = TREE_PROFILES.map((p) => p.fileLine);
const on = (list: string[]) => (p: string): boolean => list.includes(p);
const c = (acceptance: string | null): Card => ({ customId: "a", intent: "generate", targets: ["x.ts"], contextSlice: [], instruction: "i",
  acceptance, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: [] });
const MAIN_GO = "cmd/tool/main.go:6:2: m.Old undefined (type *rate.Meter has no field or method Old)";

test("Transaction Deck example 1: some card's first line is the mark", () => {
  expect(TRANSACTION_MARK).toBe("# morph: subset transaction");
  expect([isTransactionDeck([c(TRANSACTION_MARK + "\nexit 0"), c(null)]), isTransactionDeck([c("exit 0"), c(null)]), isTransactionDeck([])])
    .toStrictEqual([true, false, false]);
});

test("Transaction Deck example 2: only a first line equal to the mark counts", () => {
  expect([isTransactionDeck([c(TRANSACTION_MARK)]), isTransactionDeck([c(" " + TRANSACTION_MARK + "\nexit 0")]),
    isTransactionDeck([c("exit 0\n" + TRANSACTION_MARK + "\n")])]).toStrictEqual([false, false, false]);
});

test("Blame Log example 1: a Go log, owners, the gone probe and an outside caller", () => {
  const owners = { "rate/rate.go": "k7", "pump/flow.go": "p2", "rate/rate_examples_test.go": "kj" };
  expect(blameLog(logs().go, "k7", owners, FL, on(["cmd/tool/main.go", "pump/flow.go", "rate/rate.go"]))).toStrictEqual({ cards: ["k7", "p2"], outside: [MAIN_GO] });
  expect(blameLog(logs().go, "k7", { "rate/rate.go": "k7", "pump/flow.go": "p2" }, FL, () => false)).toStrictEqual({ cards: ["k7", "p2"], outside: [] });
});

test("Blame Log example 2: a TypeScript log, three owners; then every path on disk", () => {
  const owners = { "src/units/len.ts": "w3", "src/report/total.ts": "rt", "tests/report/total.examples.test.ts": "rtj" };
  expect(blameLog(logs().typescript, "w3", owners, FL, on(Object.keys(owners)))).toStrictEqual({ cards: ["rt", "rtj", "w3"], outside: [] });
  const want: Blame = { cards: ["rt"], outside: [
    "probe/w3/w3.probe.ts(2,10): error TS2305: Module '\"../../src/units/len.js\"' has no exported member 'toYards'.",
    "src/units/len.ts(9,3): error TS1005: ';' expected.",
    "tests/report/total.examples.test.ts(5,44): error TS2554: Expected 3 arguments, but got 2."] };
  expect(blameLog(logs().typescript, "rt", { "src/report/total.ts": "rt" }, FL, () => true)).toStrictEqual(want);
});

test("Blame Log example 3: no file line blames the card itself, another card's file only blames that card", () => {
  expect(blameLog(logs().none, "n4", { "src/a.ts": "q" }, FL, () => true)).toStrictEqual({ cards: ["n4"], outside: [] });
  expect(blameLog("", "n4", {}, FL, () => true)).toStrictEqual({ cards: ["n4"], outside: [] });
  expect(blameLog("src/a.ts(1,1): error TS1: x\n", "z", { "src/a.ts": "q" }, FL, () => true)).toStrictEqual({ cards: ["q"], outside: [] });
  expect(blameLog(logs().go, "k7", {}, [], () => true)).toStrictEqual({ cards: ["k7"], outside: [] });
});

test("Blame Log example 4: the patterns given, in their order", () => {
  expect(blameLog(logs().go, "k7", { "pump/flow.go": "p2" }, [FL[1], FL[2]], () => true))
    .toStrictEqual({ cards: ["p2"], outside: [MAIN_GO, "rate/k7_probe_test.go:9:2: undefined: rate.Mid", "rate/rate.go:3:1: missing return"] });
});

test("row: the first matching pattern wins, a tab or '#' line is skipped, the inputs unchanged", () => {
  const owners = { "a/b.x": "o1" };
  const before = JSON.stringify(owners);
  const got = blameLog("\ta/b.x:1: tab\n# a/b.x:2: hash\na/b.x:3: one\r\nq/r.x:4: two\n", "me", owners, ["^(a/\\S+?\\.x)(:\\d+.*)$", "^(\\S+?\\.x)(:\\d+.*)$"], (p) => p === "q/r.x");
  expect([got, JSON.stringify(owners)]).toStrictEqual([{ cards: ["o1"], outside: ["q/r.x:4: two"] }, before]);
});
