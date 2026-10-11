import { test, expect } from "vitest";
import { fixture } from "../helpers.js";
import { loadDeck } from "../../src/cards/model.js";
import { findHazards } from "../../src/cards/hazards.js";
import type { Deck } from "../../src/cards/types.js";

function deckOf(name: string): Deck {
  const r = loadDeck(fixture(`decks/${name}`));
  if (!r.ok) expect.unreachable(r.faults.map((f) => f.key).join(","));
  return r.deck;
}

test("Find Hazards example 1", () => {
  const deck = deckOf("hazardsWriteWrite.json");
  const hazards = findHazards(deck);
  expect(hazards.length).toBe(1);
  expect(hazards[0]?.kind).toBe("write-write");
  expect(hazards[0]?.severity).toBe("error");
  expect(hazards[0]?.cards.join(",")).toBe("a,b");
  expect(hazards[0]?.path).toBe("src/x.ts");
  expect(JSON.stringify(hazards[0]?.repair)).toBe("null");
});

test("Find Hazards example 2", () => {
  const deck = deckOf("hazardsReadWrite.json");
  const hazards = findHazards(deck);
  expect(hazards.length).toBe(1);
  expect(hazards[0]?.kind).toBe("read-write");
  expect(hazards[0]?.severity).toBe("error");
  expect(hazards[0]?.cards.join(",")).toBe("b,a");
  expect(hazards[0]?.path).toBe("src/x.ts");
  expect(JSON.stringify(hazards[0]?.repair)).toBe(
    '{"addDependsOn":{"card":"b","on":"a"}}',
  );
});

test("unordered-read: reader in generation 0 of a target in generation 1", () => {
  const deck = deckOf("hazardsUnordered.json");
  const hazards = findHazards(deck);
  expect(hazards.length).toBe(1);
  expect(hazards[0]?.kind).toBe("unordered-read");
  expect(hazards[0]?.severity).toBe("warning");
  expect(hazards[0]?.cards.join(",")).toBe("a,b");
  expect(hazards[0]?.path).toBe("src/b.ts");
  expect(JSON.stringify(hazards[0]?.repair)).toBe("null");
});

test("implicit-read: a card with an empty contextSlice", () => {
  const deck = deckOf("tiny.json");
  const hazards = findHazards(deck);
  expect(hazards.length).toBe(1);
  expect(hazards[0]?.kind).toBe("implicit-read");
  expect(hazards[0]?.severity).toBe("warning");
  expect(hazards[0]?.cards.join(",")).toBe("a");
  expect(hazards[0]?.path).toBe(null);
  expect(JSON.stringify(hazards[0]?.repair)).toBe("null");
});

test("implicit-read is reported in addition to other hazards", () => {
  const deck = deckOf("hazardsUnordered.json");
  const hazards = findHazards(deck);
  expect(hazards.every((h) => h.cards.length > 0)).toBe(true);
});

test("two writers of one path give the reader one read-write per writer", () => {
  const deck = deckOf("hazardsTwoWriters.json");
  const hazards = findHazards(deck);
  expect(hazards.length).toBe(3);
  expect(hazards[0]?.kind).toBe("write-write");
  expect(hazards[0]?.cards.join(",")).toBe("a,b");
  expect(hazards[1]?.kind).toBe("read-write");
  expect(hazards[1]?.cards.join(",")).toBe("c,a");
  expect(JSON.stringify(hazards[1]?.repair)).toBe(
    '{"addDependsOn":{"card":"c","on":"a"}}',
  );
  expect(hazards[2]?.kind).toBe("read-write");
  expect(hazards[2]?.cards.join(",")).toBe("c,b");
  expect(JSON.stringify(hazards[2]?.repair)).toBe(
    '{"addDependsOn":{"card":"c","on":"b"}}',
  );
});

test("kind order: write-write, read-write, unordered-read, implicit-read", () => {
  const deck = deckOf("hazardsAllKinds.json");
  const hazards = findHazards(deck);
  expect(hazards.length).toBe(5);
  expect(hazards.map((h) => h.kind).join(",")).toBe(
    "write-write,read-write,read-write,unordered-read,implicit-read",
  );
});

test("bytes and cap are absent on generation hazards", () => {
  const deck = deckOf("hazardsAllKinds.json");
  for (const h of findHazards(deck)) {
    expect("bytes" in h).toBe(false);
    expect("cap" in h).toBe(false);
  }
});

test("implicit-read cards list holds the one card id in deck order", () => {
  const deck = deckOf("hazardsAllKinds.json");
  const hazards = findHazards(deck);
  const implicit = hazards.filter((h) => h.kind === "implicit-read");
  expect(implicit.length).toBe(1);
  expect(implicit[0]?.cards.join(",")).toBe("e");
});
