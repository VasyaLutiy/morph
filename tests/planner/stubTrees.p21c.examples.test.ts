import { expect, test } from "vitest";
import { TRANSACTION_MARK } from "../../src/cards/transaction.js";
import type { Card } from "../../src/cards/types.js";
import { stubTrees, type StubTree, type TreeLanguage } from "../../src/planner/stubTrees.js";
import { fixtureJson } from "../helpers.js";

// The typescript, python and go entries of the Stub Trees examples.
const L: TreeLanguage[] = [
  { id: "typescript", extensions: [".ts", ".tsx"], config: "tsconfig.card.json" },
  { id: "python", extensions: [".py", ".pyi"], config: null },
  { id: "go", extensions: [".go"], config: "full.json" },
];

const GENERATIONS = [
  ["a", "n", "t", "p"],
  ["b", "c", "v", "u"],
  ["j"],
];

const STUB_DIR = "decks/q9/_stubs";

const STUBS = [
  "calc/a.go",
  "calc/a_examples_test.go",
  "calc/b.go",
  "calc/b_test.go",
  "calc/n.go",
  "extra/z.go",
  "report/c.go",
  "src/t.ts",
  "tests/t.test.ts",
];

const MARKED = ["a", "u", "j"];

function cards(): Card[] {
  return fixtureJson("planner/stub.cards.json") as Card[];
}

function marked(ids: readonly string[]): Card[] {
  return cards().map((card) =>
    ids.includes(card.customId)
      ? { ...card, acceptance: TRANSACTION_MARK + "\n" + (card.acceptance ?? "") }
      : card,
  );
}

function cutTrees(deck: Card[]): StubTree[] {
  return stubTrees(deck, GENERATIONS, STUB_DIR, STUBS, L);
}

function p21cTrees(): StubTree[] {
  return (fixtureJson("planner/stub.trees.p21c.json") as { "4": StubTree[] })["4"];
}

function findTree(trees: StubTree[], id: string): StubTree | undefined {
  return trees.find((tree) => tree.card === id);
}

test("Stub Trees example 4: a marked card stubs the targets of the whole subset", () => {
  expect(cutTrees(marked(MARKED))).toStrictEqual(p21cTrees());
});

test("Stub Trees: marking a, u and j changes only their trees", () => {
  const plain = cutTrees(cards());
  const cut = cutTrees(marked(MARKED));
  const byId = new Map<string, StubTree>(plain.map((tree): [string, StubTree] => [tree.card, tree]));
  for (const id of ["n", "t", "p", "b", "c", "v"]) {
    expect(findTree(cut, id)).toStrictEqual(byId.get(id));
  }
});

test("Stub Trees: a mark that is not the first line changes nothing", () => {
  const late = cards().map((card) => {
    if (!MARKED.includes(card.customId)) return card;
    const head = "echo start\n" + TRANSACTION_MARK + "\n";
    return { ...card, acceptance: head + (card.acceptance ?? "") };
  });
  expect(cutTrees(late)).toStrictEqual(cutTrees(cards()));
});

test("Stub Trees: one marked card stubs the whole subset", () => {
  expect(findTree(cutTrees(marked(["a"])), "a")).toStrictEqual(findTree(p21cTrees(), "a"));
});
