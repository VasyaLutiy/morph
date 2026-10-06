import { describe, expect, test } from "vitest";
import { loadDeck, validateCard } from "../../src/cards/model.js";
import type { DeckResult } from "../../src/cards/types.js";
import { fixture, fixtureJson } from "../helpers.js";

function expectDeckOk(r: DeckResult): Exclude<DeckResult, { ok: false }> {
  if (!r.ok) {
    expect.unreachable(`expected deck to load, got faults: ${r.faults.length}`);
  }
  return r;
}

describe("Validate Card", () => {
  test("Validate Card example 1", () => {
    const deck = fixtureJson("decks/tiny.json");
    if (!Array.isArray(deck) || deck.length !== 1) {
      expect.unreachable("tiny.json should be a one-element deck array");
    }
    const r = validateCard(deck[0]);
    if (!r.ok) {
      expect.unreachable(`expected a valid card, got ${r.faults.length} fault(s)`);
    }
    expect(r.card.customId).toBe("a");
    expect(r.card.intent).toBe("generate");
    expect(JSON.stringify(r.card.targets)).toBe('["src/a.ts"]');
    expect(r.card.instruction).toBe("x");
    expect(JSON.stringify(r.card.contextSlice)).toBe("[]");
    expect(r.card.variants).toBe(1);
    expect(JSON.stringify(r.card.dependsOn)).toBe("[]");
    expect(r.card.acceptance).toBe(null);
  });

  test("Validate Card example 2", () => {
    const r = validateCard(fixtureJson("cards/badId.json"));
    if (r.ok) {
      expect.unreachable("expected a fault, got a card");
    }
    expect(r.faults.length).toBe(1);
    expect(r.faults[0].key).toBe("customId");
    expect(r.faults[0].message).toBe(
      "customId 'bad id' does not match ^[A-Za-z0-9._-]+$",
    );
  });

  test("Validate Card example 3", () => {
    const r = validateCard(fixtureJson("cards/threeFaults.json"));
    if (r.ok) {
      expect.unreachable("expected faults, got a card");
    }
    expect(r.faults.length).toBe(3);
    expect(r.faults[0].key).toBe("intent");
    expect(r.faults[0].message).toBe("intent 'todo' is not generate|patch");
    expect(r.faults[1].key).toBe("targets");
    expect(r.faults[1].message).toBe("targets is empty");
    expect(r.faults[2].key).toBe("instruction");
    expect(r.faults[2].message).toBe("instruction is empty");
  });

  test("Validate Card example 4", () => {
    const r = validateCard(fixtureJson("cards/repeatTarget.json"));
    if (r.ok) {
      expect.unreachable("expected a fault, got a card");
    }
    expect(r.faults.length).toBe(1);
    expect(r.faults[0].key).toBe("targets");
    expect(r.faults[0].message).toBe("targets repeat src/a.ts after normalisation");
  });
});

describe("Load Deck", () => {
  test("Load Deck example 1", () => {
    const r = loadDeck(fixture("decks/duplicate.json"));
    if (r.ok) {
      expect.unreachable("expected a fault, got a deck");
    }
    expect(r.faults.length).toBe(1);
    expect(r.faults[0].key).toBe("cards[2].customId");
    expect(r.faults[0].message).toBe("duplicate customId b");
  });

  test("Load Deck example 2", () => {
    const r = loadDeck(fixture("decks/cycle.json"));
    if (r.ok) {
      expect.unreachable("expected a fault, got a deck");
    }
    expect(r.faults.length).toBe(1);
    expect(r.faults[0].key).toBe("dependsOn");
    expect(r.faults[0].message).toBe("dependsOn cycle a -> b -> a");
  });

  test("Load Deck example 3", () => {
    const r = expectDeckOk(loadDeck(fixture("decks/external.json")));
    expect(JSON.stringify(r.deck.externalDependsOn)).toBe('["zzz"]');
  });
});

describe("validateCard section 2.2 rules", () => {
  test("a non-object gives the single card fault", () => {
    const r = validateCard(["a"]);
    if (r.ok) {
      expect.unreachable("expected a fault, got a card");
    }
    expect(r.faults.length).toBe(1);
    expect(r.faults[0].key).toBe("card");
    expect(r.faults[0].message).toBe("card is not an object");
  });

  test("required keys missing each give their own fault", () => {
    const r = validateCard({ instruction: "x" });
    if (r.ok) {
      expect.unreachable("expected faults, got a card");
    }
    expect(r.faults.length).toBe(3);
    expect(r.faults[0].key).toBe("customId");
    expect(r.faults[0].message).toBe("customId is required");
    expect(r.faults[1].key).toBe("intent");
    expect(r.faults[1].message).toBe("intent is required");
    expect(r.faults[2].key).toBe("targets");
    expect(r.faults[2].message).toBe("targets is required");
  });

  test("unknown keys are faults in input order", () => {
    const r = validateCard({
      customId: "a",
      intent: "generate",
      targets: ["src/a.ts"],
      instruction: "x",
      extra: 1,
    });
    if (r.ok) {
      expect.unreachable("expected a fault, got a card");
    }
    expect(r.faults.length).toBe(1);
    expect(r.faults[0].key).toBe("extra");
    expect(r.faults[0].message).toBe("extra is not a Card key");
  });

  test("a non repo-relative target is a fault", () => {
    const r = validateCard({
      customId: "a",
      intent: "generate",
      targets: ["../out.ts"],
      instruction: "x",
    });
    if (r.ok) {
      expect.unreachable("expected a fault, got a card");
    }
    expect(r.faults.length).toBe(1);
    expect(r.faults[0].key).toBe("targets");
    expect(r.faults[0].message).toBe("targets '../out.ts' is not repo-relative");
  });

  test("reasoning accepts {effort} and rejects other shapes", () => {
    const good = validateCard({
      customId: "a",
      intent: "generate",
      targets: ["src/a.ts"],
      instruction: "x",
      reasoning: { effort: "high" },
    });
    if (!good.ok) {
      expect.unreachable(`expected a valid card, got ${good.faults.length} fault(s)`);
    }
    expect(JSON.stringify(good.card.reasoning)).toBe('{"effort":"high"}');

    const bad = validateCard({
      customId: "a",
      intent: "generate",
      targets: ["src/a.ts"],
      instruction: "x",
      reasoning: { effort: "urgent" },
    });
    if (bad.ok) {
      expect.unreachable("expected a fault, got a card");
    }
    expect(bad.faults.length).toBe(1);
    expect(bad.faults[0].key).toBe("reasoning");
    expect(bad.faults[0].message).toBe(
      "reasoning is not {maxTokens} or {effort} or null",
    );
  });

  test("variants must be an integer >= 1", () => {
    const r = validateCard({
      customId: "a",
      intent: "generate",
      targets: ["src/a.ts"],
      instruction: "x",
      variants: 0,
    });
    if (r.ok) {
      expect.unreachable("expected a fault, got a card");
    }
    expect(r.faults.length).toBe(1);
    expect(r.faults[0].key).toBe("variants");
    expect(r.faults[0].message).toBe("variants is not an integer >= 1");
  });

  test("a valid full card normalises defaults", () => {
    const r = validateCard({
      customId: "a.b-1",
      intent: "patch",
      targets: ["./src/a.ts"],
      instruction: "  do it  ",
    });
    if (!r.ok) {
      expect.unreachable(`expected a valid card, got ${r.faults.length} fault(s)`);
    }
    expect(r.card.customId).toBe("a.b-1");
    expect(JSON.stringify(r.card.targets)).toBe('["src/a.ts"]');
    expect(r.card.instruction).toBe("  do it  ");
    expect(r.card.model).toBe(null);
    expect(r.card.maxTokens).toBe(null);
    expect(r.card.reasoning).toBe(null);
    expect(r.card.variants).toBe(1);
  });

  test("dependsOn entries must match the id pattern", () => {
    const r = validateCard({
      customId: "a",
      intent: "generate",
      targets: ["src/a.ts"],
      instruction: "x",
      dependsOn: ["bad id"],
    });
    if (r.ok) {
      expect.unreachable("expected a fault, got a card");
    }
    expect(r.faults.length).toBe(1);
    expect(r.faults[0].key).toBe("dependsOn");
    expect(r.faults[0].message).toBe(
      "dependsOn 'bad id' does not match ^[A-Za-z0-9._-]+$",
    );
  });
});

describe("loadDeck section 2.2 rules", () => {
  test("not valid JSON gives one deck fault", () => {
    const r = loadDeck("{ not json");
    if (r.ok) {
      expect.unreachable("expected a fault, got a deck");
    }
    expect(r.faults.length).toBe(1);
    expect(r.faults[0].key).toBe("deck");
    expect(r.faults[0].message.startsWith("deck is not valid JSON: ")).toBe(true);
  });

  test("a non-array JSON document is not a deck", () => {
    const r = loadDeck('{"customId": "a"}');
    if (r.ok) {
      expect.unreachable("expected a fault, got a deck");
    }
    expect(r.faults.length).toBe(1);
    expect(r.faults[0].key).toBe("deck");
    expect(r.faults[0].message).toBe("deck is not a JSON array");
  });

  test("element faults are re-keyed with their index", () => {
    const r = loadDeck(fixture("decks/tiny.json").replace('"a"', '"bad id"'));
    if (r.ok) {
      expect.unreachable("expected a fault, got a deck");
    }
    expect(r.faults.length).toBe(1);
    expect(r.faults[0].key).toBe("cards[0].customId");
    expect(r.faults[0].message).toBe(
      "customId 'bad id' does not match ^[A-Za-z0-9._-]+$",
    );
  });
});
