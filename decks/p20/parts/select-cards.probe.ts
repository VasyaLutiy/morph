// P20 probe for select-cards by docs/TASK_P20_rerun.md §2.2 (src/planner/selectCards.ts) — the plan cut down to the
// cards of `--only`, ordered again (issue #11). Record Select Cards examples 1-4 on tests/fixtures/planner/subset.plan.json,
// then rows.
import { test, expect } from "vitest";
import { selectCards } from "../../src/planner/selectCards.js";
import type { SelectResult } from "../../src/planner/selectCards.js";
import type { Plan } from "../../src/planner/types.js";
import { fixtureJson } from "../../tests/helpers.js";

const fresh = (): Plan => fixtureJson("planner/subset.plan.json") as Plan;
const ids = (r: SelectResult): unknown => (r.ok ? [r.plan.cards.map((c) => c.customId), r.plan.generations, r.plan.externalDependsOn] : r.error);

test("Select Cards example 1: a kept card's dropped dependency becomes external", () => {
  const plan = fresh();
  const r = selectCards(plan, ["d", "c"]);
  expect(ids(r)).toStrictEqual([["c", "d"], [["c"], ["d"]], { c: ["a"], d: ["b"] }]);
  expect(r.ok ? [r.plan.spec, r.plan.components] : null).toStrictEqual(["s.yaml", ["k"]]);
  expect(r.ok ? [r.plan.cards[0] === plan.cards[3], r.plan.cards[1] === plan.cards[4]] : null).toStrictEqual([true, true]);
});

test("Select Cards example 2: generations among the kept cards; an outside dependency stays external", () => {
  expect(ids(selectCards(fresh(), ["e", "b", "a"]))).toStrictEqual([["a", "e", "b"], [["a", "e"], ["b"]], { e: ["outside"] }]);
});

test("Select Cards example 3: unknown ids, in only's order", () => {
  expect(selectCards(fresh(), ["zz", "c", "y.1"])).toStrictEqual({ ok: false, error: "--only names cards the plan does not have: zz, y.1" });
});

test("Select Cards example 4: every card kept gives the plan back", () => {
  expect(selectCards(fresh(), ["d", "c", "b", "e", "a"])).toStrictEqual({ ok: true, plan: fresh() });
});

test("row: the plan is not changed; one unknown id; a single card", () => {
  const plan = fresh();
  selectCards(plan, ["d"]);
  selectCards(plan, ["b", "q"]);
  expect(plan).toStrictEqual(fresh());
  expect(selectCards(plan, ["b", "q"])).toStrictEqual({ ok: false, error: "--only names cards the plan does not have: q" });
  expect(ids(selectCards(plan, ["d"]))).toStrictEqual([["d"], [["d"]], { d: ["b", "c"] }]);
  const r = selectCards(plan, ["b"]);
  expect(r.ok ? r.plan.cards[0] : null).toBe(plan.cards[2]);
});
