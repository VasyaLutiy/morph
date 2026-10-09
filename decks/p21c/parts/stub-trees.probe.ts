// P21c probe for stub-trees by docs/TASK_P21c_transaction.md §2.2 (src/planner/stubTrees.ts) — a card of a transaction
// deck (its acceptance starts with TRANSACTION_MARK) is checked on the tree of the whole subset written: every card's
// targets of its language stubbed. Record Stub Trees example 4 on stub.cards.json and stub.trees.p21c.json, then rows.
import { test, expect } from "vitest";
import { stubTrees } from "../../src/planner/stubTrees.js";
import type { StubTree, TreeLanguage } from "../../src/planner/stubTrees.js";
import { TRANSACTION_MARK } from "../../src/cards/transaction.js";
import type { Card } from "../../src/cards/types.js";
import { fixtureJson } from "../../tests/helpers.js";

const cards = (): Card[] => fixtureJson("planner/stub.cards.json") as Card[];
const marked = (ids: string[]): Card[] => cards().map((c) => (ids.includes(c.customId) ? { ...c, acceptance: TRANSACTION_MARK + "\n" + (c.acceptance ?? "") } : c));
const L: TreeLanguage[] = [{ id: "typescript", extensions: [".ts", ".tsx"], config: "tsconfig.card.json" },
  { id: "python", extensions: [".py", ".pyi"], config: null }, { id: "go", extensions: [".go"], config: "full.json" }];
const G1 = [["a", "n", "t", "p"], ["b", "c", "v", "u"], ["j"]];
const S4 = ["calc/a.go", "calc/a_examples_test.go", "calc/b.go", "calc/b_test.go", "calc/n.go", "extra/z.go", "report/c.go", "src/t.ts", "tests/t.test.ts"];

test("Stub Trees example 4: a marked card's tree holds every card of every generation", () => {
  const want = (fixtureJson("planner/stub.trees.p21c.json") as Record<string, StubTree[]>)["4"];
  const got = stubTrees(marked(["a", "u", "j"]), G1, "decks/q9/_stubs", S4, L);
  expect(got).toStrictEqual(want);
  const a = got.find((t) => t.card === "a");
  expect([Object.keys(a?.stubs ?? {}), a?.missing]).toStrictEqual([["calc/a.go", "calc/n.go", "calc/b.go", "calc/b_test.go", "report/c.go", "calc/a_examples_test.go"], ["calc/v.go"]]);
});

test("row: the unmarked cards of example 4 equal the same call without any mark", () => {
  const got = stubTrees(marked(["a", "u", "j"]), G1, "decks/q9/_stubs", S4, L);
  const plain = stubTrees(cards(), G1, "decks/q9/_stubs", S4, L);
  for (const id of ["n", "t", "p", "b", "c", "v"]) {
    expect(got.find((t) => t.card === id)).toStrictEqual(plain.find((t) => t.card === id));
  }
  expect(Object.keys(plain.find((t) => t.card === "a")?.stubs ?? {})).toStrictEqual(["calc/a.go"]);
});

test("row: the mark must be the acceptance's first line", () => {
  const cs = cards().map((c) => (c.customId === "a" ? { ...c, acceptance: (c.acceptance ?? "") + "\n" + TRANSACTION_MARK + "\n" } : c));
  const a = stubTrees(cs, G1, "st", S4, L).find((t) => t.card === "a");
  expect(Object.keys(a?.stubs ?? {})).toStrictEqual(["calc/a.go"]);
});
