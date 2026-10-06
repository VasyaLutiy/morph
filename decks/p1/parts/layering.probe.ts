// P1 probe for layering: layerGenerations by docs/TASK_P1_cards.md §2.2, one test per record
// example, values and types. Runs from probe/layering/ under vitest.
import { test, expect } from "vitest";
import { layerGenerations } from "../../src/cards/layer.js";
import { loadDeck } from "../../src/cards/model.js";
import type { Deck } from "../../src/cards/types.js";
import { fixture } from "../../tests/helpers.js";

function deck(name: string): Deck {
  const r = loadDeck(fixture(`decks/${name}.json`));
  if (!r.ok) throw new Error(`${name}: ` + r.faults.map((f) => f.message).join("; "));
  return r.deck;
}

test("Layer Generations example 1: longest dependsOn path", () => {
  const got: string[][] = layerGenerations(deck("layered"));
  expect(JSON.stringify(got), "generations").toBe('[["a"],["b","c"],["d"]]');
});

test("Layer Generations example 2: an external dependency does not count", () => {
  expect(JSON.stringify(layerGenerations(deck("layeredExternal"))), "generations").toBe('[["a","b"]]');
});

test("Layer Generations §2.2: empty deck, deck order kept, cycle throws", () => {
  expect(JSON.stringify(layerGenerations({ cards: [], externalDependsOn: [] })), "empty").toBe("[]");
  const d = deck("layered");
  const reversed: Deck = { cards: [...d.cards].reverse(), externalDependsOn: [] };
  expect(JSON.stringify(layerGenerations(reversed)), "deck order within a generation").toBe('[["a"],["c","b"],["d"]]');
  const a = d.cards[0];
  const b = d.cards[1];
  if (a === undefined || b === undefined) throw new Error("layered.json has fewer than two cards");
  const cyclic: Deck = { cards: [{ ...a, dependsOn: ["b"] }, { ...b, dependsOn: ["a"] }], externalDependsOn: [] };
  let msg = "no throw";
  try { layerGenerations(cyclic); } catch (e) { msg = (e as Error).message; }
  expect(msg.startsWith("dependsOn cycle"), `cycle throws, got: ${msg}`).toBe(true);
});
