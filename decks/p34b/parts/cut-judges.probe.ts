// P34b probe for cut-judges by docs/TASK_P34b_contour.md §2.2 (src/planner/judges.ts) — issue #44: no judge for a card
// none of whose Functions has an example, examples only of the Functions that have them, no empty Behaviour line of
// a callee. Record Cut Judges example 5; unchanged row: Cut Judges 1 (ledger.judges.json).
import { test, expect } from "vitest";
import { cutJudges } from "../../src/planner/judges.js";
import { cutComponent } from "../../src/planner/cut.js";
import { TYPESCRIPT } from "../../src/language/profiles.js";
import { loadContour, loadMap } from "../../src/contour/load.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";
import type { Card } from "../../src/cards/types.js";
import type { ContourMap, ContourRecord } from "../../src/contour/types.js";
import type { CutCard, Plan } from "../../src/planner/types.js";

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
function judges(rec: ContourRecord, map: ContourMap, docs: string[], spec: string): Card[] {
  const cuts: CutCard[] = rec.system.groups.flatMap((c) => {
    const r = cutComponent({ record: rec, component: c, map, docs, spec });
    if (!r.ok) throw new Error(r.error);
    return r.cuts;
  });
  return cutJudges({ record: rec, cuts, map, docs, defaultProfile: TYPESCRIPT, hasFile: (p) => p === "tests/helpers.ts" });
}
const EV = (): Card[] => judges(record("planner/events.yaml"), contourMap("planner/events.map.json"), [], "events.yaml");
const byId = (cards: Card[], id: string): Card => cards.find((c) => c.customId === id) as Card;

test("Cut Judges example 5: no judge for Price Cart, the judges equal events.plan.json's", () => {
  const cards = EV();
  expect(cards.map((c) => c.customId)).toStrictEqual(["place-order-judge", "cancel-order-judge", "orders-api-judge", "prices-judge"]);
  const plan = fixtureJson("planner/events.plan.json") as Plan;
  for (const card of cards) expect(card).toStrictEqual(byId(plan.cards, card.customId));
});

test("Cut Judges example 5: a callee without behavior has no Behaviour line", () => {
  expect(byId(EV(), "place-order-judge").instruction.endsWith("\n\nCallee Price Cart: Prices every item of a cart.")).toBe(true);
});

test("Cut Judges example 5: a group lists only the Functions with examples", () => {
  const text = byId(EV(), "prices-judge").instruction;
  expect(text).toContain('e.g. "List Prices example 1".');
  expect(text).toContain("Examples of Function List Prices:");
  expect(text).not.toContain("Examples of Function Format Price");
});

test("unchanged: Cut Judges example 1, the ledger judges", () => {
  const rec = record("planner/ledger.yaml");
  const map = contourMap("planner/ledger.map.json");
  const cuts: CutCard[] = rec.system.groups.flatMap((c) => {
    const r = cutComponent({ record: rec, component: c, map, docs: ["docs/TASK.md"], spec: "ledger.yaml" });
    if (!r.ok) throw new Error(r.error);
    return r.cuts;
  });
  const cards = cutJudges({ record: rec, cuts, map, docs: ["docs/TASK.md"], defaultProfile: TYPESCRIPT, hasFile: (p) => p === "tests/helpers.ts" });
  expect(cards).toStrictEqual(fixtureJson("planner/ledger.judges.json"));
});
