// P21b probe for stub-trees by docs/TASK_P21b_deckcheck.md §2.2 (src/planner/stubTrees.ts) — per card of a deck, the
// tree its first attempt compiles on, the gate's stubs in place, any language (issue #12 item 3.5, comment 6077766447).
// Record Stub Trees examples 1-3 on tests/fixtures/planner/stub.cards.json and stub.trees.json, then rows.
import { test, expect } from "vitest";
import { stubTrees } from "../../src/planner/stubTrees.js";
import type { StubTree, TreeLanguage } from "../../src/planner/stubTrees.js";
import type { Card } from "../../src/cards/types.js";
import { fixtureJson } from "../../tests/helpers.js";

const cards = (): Card[] => fixtureJson("planner/stub.cards.json") as Card[];
const trees = (k: string): StubTree[] => (fixtureJson("planner/stub.trees.json") as Record<string, StubTree[]>)[k];
const L: TreeLanguage[] = [{ id: "typescript", extensions: [".ts", ".tsx"], config: "tsconfig.card.json" },
  { id: "python", extensions: [".py", ".pyi"], config: null }, { id: "go", extensions: [".go"], config: "full.json" }];
const G1 = [["a", "n", "t", "p"], ["b", "c", "v", "u"], ["j"]];
const S1 = ["calc/a.go", "calc/a_examples_test.go", "calc/b.go", "extra/z.go", "report/c.go", "src/t.ts", "tests/t.test.ts"];

test("Stub Trees example 1: own and earlier targets of the card's language stubbed, config and exports read", () => {
  expect(stubTrees(cards(), G1, "decks/q9/_stubs", S1, L)).toStrictEqual(trees("1"));
});

test("Stub Trees example 2: unknown ids skipped, an absolute stub dir", () => {
  expect(stubTrees(cards(), [["a"], ["zz", "j"]], "/abs/st", ["calc/a_examples_test.go"], L)).toStrictEqual(trees("2"));
});

test("Stub Trees example 3: a language not given is no language", () => {
  expect(stubTrees(cards(), [["a", "t", "u"]], "st", ["calc/a.go", "src/t.ts", "tests/t.test.ts", "tests/u.test.ts"], [L[2]])).toStrictEqual(trees("3"));
});

test("row: siblings are never stubbed, and the inputs are never changed", () => {
  const cs = cards();
  const before = JSON.stringify(cs);
  const g = G1.map((x) => [...x]);
  const s = [...S1];
  const got = stubTrees(cs, g, "decks/q9/_stubs", s, L);
  expect(JSON.stringify(cs) + JSON.stringify(g) + JSON.stringify(s)).toBe(before + JSON.stringify(G1) + JSON.stringify(S1));
  const b = got.find((t) => t.card === "b");
  expect([Object.keys(b?.stubs ?? {}), b?.own]).toStrictEqual([["calc/a.go", "calc/b.go"], ["calc/b.go", "calc/b_test.go"]]);
  b?.own.push("x");
  expect(cs.find((c) => c.customId === "b")?.targets).toStrictEqual(["calc/b.go", "calc/b_test.go"]);
});

test("row: the heredoc tag is the card's own, a line must equal it; only NAME= export lines", () => {
  const tag = "MY" + "_TAG";
  const base = cards()[0];
  const acc = "  export A_1=x\nexport default defineConfig({});\nexport b=1\ncat > $P/q.json <<'" + tag + "'\n{\"k\": 1}\n " + tag + "\nline 2\n" + tag + "\n";
  const x: Card = { ...base, customId: "x", targets: ["k/x.zz"], acceptance: acc };
  expect(stubTrees([x], [["x"]], "st", ["k/x.zz"], [{ id: "zz", extensions: [".zz"], config: "q.json" }])).toStrictEqual([
    { card: "x", generation: 0, language: "zz", exports: ["export A_1=x", "export b=1"], config: { name: "q.json", text: "{\"k\": 1}\n " + tag + "\nline 2" },
      stubs: { "k/x.zz": "st/k/x.zz" }, own: ["k/x.zz"], missing: [] }]);
});
