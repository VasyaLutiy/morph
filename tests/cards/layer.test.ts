import { describe, expect, test } from "vitest";
import { layerGenerations } from "../../src/cards/layer.js";
import { loadDeck } from "../../src/cards/model.js";
import { fixture } from "../helpers.js";

describe("layerGenerations", () => {
  test("layered fixture layers by longest dependsOn path", () => {
    const result = loadDeck(fixture("decks/layered.json"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(layerGenerations(result.deck))).toBe('[["a"],["b","c"],["d"]]');
  });

  test("layeredExternal fixture puts external dependencies in generation 0", () => {
    const result = loadDeck(fixture("decks/layeredExternal.json"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(layerGenerations(result.deck))).toBe('[["a","b"]]');
  });

  test("empty deck layers to []", () => {
    const result = loadDeck("[]");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(layerGenerations(result.deck))).toBe("[]");
  });

  test("a hand-built Deck with a cycle throws dependsOn cycle", () => {
    const result = loadDeck(fixture("decks/layered.json"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const deck = result.deck;
    deck.cards[0].dependsOn = ["d"];
    expect(() => layerGenerations(deck)).toThrow(/^dependsOn cycle/);
  });
});
