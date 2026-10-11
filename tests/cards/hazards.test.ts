import { describe, expect, test } from "vitest";
import { findHazards } from "../../src/cards/hazards.js";
import { loadDeck } from "../../src/cards/model.js";
import { fixture } from "../helpers.js";

describe("findHazards", () => {
  test("write-write: two cards of one generation share a target", () => {
    const deck = loadDeck(fixture("decks/hazardsWriteWrite.json"));
    expect(deck.ok).toBe(true);
    if (!deck.ok) return;
    const hazards = findHazards(deck.deck);
    expect(hazards.length).toBe(1);
    expect(hazards[0]?.kind).toBe("write-write");
    expect(hazards[0]?.path).toBe("src/x.ts");
  });

  test("read-write: a slice names a sibling's target in the same generation", () => {
    const deck = loadDeck(fixture("decks/hazardsReadWrite.json"));
    expect(deck.ok).toBe(true);
    if (!deck.ok) return;
    const hazards = findHazards(deck.deck);
    expect(hazards.length).toBe(1);
    expect(hazards[0]?.kind).toBe("read-write");
    expect(hazards[0]?.path).toBe("src/x.ts");
  });
});
