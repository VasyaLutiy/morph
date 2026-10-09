// P21b probe for stub-trees by docs/TASK_P21b_deckcheck.md §2.2 (src/planner/stubTrees.ts) — per Go card of a deck, the
// overlay of the tree its first attempt builds on, the gate's stubs in place (issue #12 item 3.5). Record Stub Trees
// examples 1-3 on tests/fixtures/planner/stub.cards.json and stub.trees.json, then rows.
import { test, expect } from "vitest";
import { stubTrees } from "../../src/planner/stubTrees.js";
import type { StubTree } from "../../src/planner/stubTrees.js";
import type { Card } from "../../src/cards/types.js";
import { fixtureJson } from "../../tests/helpers.js";

const cards = (): Card[] => fixtureJson("planner/stub.cards.json") as Card[];
const trees = (k: string): StubTree[] => (fixtureJson("planner/stub.trees.json") as Record<string, StubTree[]>)[k];
const G1 = [["a", "n", "t"], ["b", "c", "v"], ["j"]];
const S1 = ["calc/a.go", "calc/a_examples_test.go", "calc/b.go", "extra/z.go", "report/c.go"];

test("Stub Trees example 1: own and earlier targets stubbed, the card's hide kept, the rest missing", () => {
  expect(stubTrees(cards(), G1, "decks/q9/_stubs", S1)).toStrictEqual(trees("1"));
});

test("Stub Trees example 2: unknown ids skipped, an absolute stub dir", () => {
  expect(stubTrees(cards(), [["a"], ["zz", "j"]], "/abs/st", ["calc/a_examples_test.go"])).toStrictEqual(trees("2"));
});

test("Stub Trees example 3: no generation, or no Go acceptance", () => {
  expect([stubTrees(cards(), [], "x", S1), stubTrees(cards(), [["t", "n", "v"]], "x", S1)]).toStrictEqual([[], []]);
});

test("row: siblings are never stubbed, and the inputs are never changed", () => {
  const cs = cards();
  const before = JSON.stringify(cs);
  const g = [["a", "n", "t"], ["b", "c", "v"], ["j"]];
  const s = [...S1];
  const got = stubTrees(cs, g, "decks/q9/_stubs", s);
  expect(JSON.stringify(cs) + JSON.stringify(g) + JSON.stringify(s)).toBe(before + JSON.stringify(G1) + JSON.stringify(S1));
  const b = got.find((t) => t.card === "b");
  expect([b?.overlay["report/c.go"], Object.keys(b?.overlay ?? {}).includes("calc/n.go"), b?.own]).toStrictEqual(["", false, ["calc/b.go", "calc/b_test.go"]]);
  b?.own.push("x");
  expect(cs.find((c) => c.customId === "b")?.targets).toStrictEqual(["calc/b.go", "calc/b_test.go"]);
});

test("row: a heredoc that is not JSON skips the card; Replace absent is {}", () => {
  const tag = "MORPH_CONF" + "_EOF";
  const acc = (json: string): string => "export GOFLAGS=-mod=mod\ncat > $P/full.json <<'" + tag + "'\n" + json + "\n" + tag + "\n";
  const base = cards()[0];
  const x: Card = { ...base, customId: "x", targets: ["k/x.go"], acceptance: acc("{not json") };
  const y: Card = { ...base, customId: "y", targets: ["k/y.go"], acceptance: acc("{}") };
  expect(stubTrees([x, y], [["x", "y"]], "st", ["k/y.go"])).toStrictEqual([
    { card: "y", generation: 0, env: "export GOFLAGS=-mod=mod", overlay: { "k/y.go": "st/k/y.go" }, own: ["k/y.go"], missing: [] }]);
});
