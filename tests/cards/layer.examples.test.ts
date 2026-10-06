import { test } from "vitest";
import { expect } from "vitest";
import { loadDeck } from "../../src/cards/model.js";
import { layerGenerations } from "../../src/cards/layer.js";
import { fixture } from "../helpers.js";

test("Layer Generations example 1", () => {
  const r = loadDeck(fixture("decks/layered.json"));
  if (!r.ok) expect.unreachable(r.faults[0]?.message ?? "loadDeck failed");
  const result = layerGenerations(r.deck);
  expect(JSON.stringify(result)).toBe('[["a"],["b","c"],["d"]]');
});

test("Layer Generations example 2", () => {
  const r = loadDeck(fixture("decks/layeredExternal.json"));
  if (!r.ok) expect.unreachable(r.faults[0]?.message ?? "loadDeck failed");
  const result = layerGenerations(r.deck);
  expect(JSON.stringify(result)).toBe('[["a","b"]]');
});

test("Layer Generations empty deck", () => {
  const r = loadDeck("[]");
  if (!r.ok) expect.unreachable(r.faults[0]?.message ?? "loadDeck failed");
  const result = layerGenerations(r.deck);
  expect(JSON.stringify(result)).toBe("[]");
});

test("Layer Generations cycle throws", () => {
  const r = loadDeck(
    JSON.stringify([
      { customId: "a", intent: "generate", targets: ["src/a.ts"], instruction: "x", dependsOn: ["b"] },
      { customId: "b", intent: "generate", targets: ["src/b.ts"], instruction: "x", dependsOn: ["a"] },
    ]),
  );
  if (r.ok) {
    expect(() => layerGenerations(r.deck)).toThrow(/^dependsOn cycle/);
  } else {
    // loadDeck rejects cycles; build a hand-made Deck to exercise the throw.
    const deck = {
      cards: [
        { customId: "a", intent: "generate" as const, targets: ["src/a.ts"], contextSlice: [], instruction: "x", acceptance: null, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: ["b"] },
        { customId: "b", intent: "generate" as const, targets: ["src/b.ts"], contextSlice: [], instruction: "x", acceptance: null, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: ["a"] },
      ],
      externalDependsOn: [],
    };
    expect(() => layerGenerations(deck)).toThrow(/^dependsOn cycle/);
  }
});

test("Layer Generations deck order within a generation", () => {
  const r = loadDeck(
    JSON.stringify([
      { customId: "z", intent: "generate", targets: ["src/z.ts"], instruction: "x" },
      { customId: "y", intent: "generate", targets: ["src/y.ts"], instruction: "x" },
    ]),
  );
  if (!r.ok) expect.unreachable(r.faults[0]?.message ?? "loadDeck failed");
  const result = layerGenerations(r.deck);
  expect(JSON.stringify(result)).toBe('[["z","y"]]');
});
