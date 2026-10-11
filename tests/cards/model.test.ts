import { describe, expect, test } from "vitest";
import { loadDeck, validateCard } from "../../src/cards/model.js";
import { fixture } from "../helpers.js";

describe("validateCard", () => {
  test("Validate Card example 1: minimal card gets the defaults", () => {
    const result = validateCard({
      customId: "a",
      intent: "generate",
      targets: ["src/a.ts"],
      instruction: "x",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.card.contextSlice.length).toBe(0);
      expect(result.card.variants).toBe(1);
      expect(result.card.dependsOn.length).toBe(0);
      expect(result.card.acceptance).toBe(null);
    }
  });

  test("Validate Card example 2: bad id gives one fault", () => {
    const result = validateCard({
      customId: "bad id",
      intent: "generate",
      targets: ["src/a.ts"],
      instruction: "x",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.faults.length).toBe(1);
      expect(result.faults[0].key).toBe("customId");
      expect(result.faults[0].message).toBe(
        "customId 'bad id' does not match ^[A-Za-z0-9._-]+$",
      );
    }
  });

  test("not an object gives the card fault", () => {
    const result = validateCard("nope");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.faults.length).toBe(1);
      expect(result.faults[0].key).toBe("card");
      expect(result.faults[0].message).toBe("card is not an object");
    }
  });
});

describe("loadDeck", () => {
  test("Load Deck: tiny fixture loads with one card", () => {
    const result = loadDeck(fixture("decks/tiny.json"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.deck.cards.length).toBe(1);
      expect(result.deck.cards[0].customId).toBe("a");
      expect(result.deck.externalDependsOn.length).toBe(0);
    }
  });

  test("Load Deck: not JSON gives one deck fault", () => {
    const result = loadDeck("{nope");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.faults.length).toBe(1);
      expect(result.faults[0].key).toBe("deck");
      expect(result.faults[0].message.startsWith("deck is not valid JSON: ")).toBe(true);
    }
  });
});
