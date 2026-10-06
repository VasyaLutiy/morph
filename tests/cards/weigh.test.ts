import { describe, expect, test } from "vitest";
import { loadDeck } from "../../src/cards/model.js";
import { weighSlices } from "../../src/cards/weigh.js";
import { tmpRoot } from "../helpers.js";

describe("weighSlices", () => {
  test("sizes and missing files: bytes summed, missing listed", () => {
    const root = tmpRoot();
    try {
      root.write("ten.txt", "0123456789");
      root.write("hundred.txt", "x".repeat(100));
      const deckResult = loadDeck(
        JSON.stringify([
          {
            customId: "a",
            intent: "generate",
            targets: ["missing.txt"],
            contextSlice: ["ten.txt", "hundred.txt"],
            instruction: "x",
          },
        ]),
      );
      if (!deckResult.ok) throw new Error("deck failed");
      const weighing = weighSlices(deckResult.deck, root.root);
      expect(weighing.weights.length).toBe(1);
      expect(weighing.weights[0]!.card).toBe("a");
      expect(weighing.weights[0]!.bytes).toBe(110);
      expect(weighing.weights[0]!.missing.length).toBe(1);
      expect(weighing.weights[0]!.missing[0]).toBe("missing.txt");
      expect(weighing.hazards.length).toBe(0);
    } finally {
      root.rm();
    }
  });

  test("oversized-slice example 1: 600001 bytes, default cap 500000", () => {
    const root = tmpRoot();
    try {
      root.write("big.txt", "x".repeat(600001));
      const deckResult = loadDeck(
        JSON.stringify([
          {
            customId: "a",
            intent: "generate",
            targets: ["big.txt"],
            instruction: "x",
          },
        ]),
      );
      if (!deckResult.ok) throw new Error("deck failed");
      const weighing = weighSlices(deckResult.deck, root.root);
      expect(weighing.hazards.length).toBe(1);
      expect(weighing.hazards[0]!.kind).toBe("oversized-slice");
      expect(weighing.hazards[0]!.severity).toBe("warning");
      expect(weighing.hazards[0]!.bytes).toBe(600001);
      expect(weighing.hazards[0]!.cap).toBe(500000);
    } finally {
      root.rm();
    }
  });

  test("custom cap: over a lowered cap, under the default", () => {
    const root = tmpRoot();
    try {
      root.write("small.txt", "y".repeat(200));
      const deckResult = loadDeck(
        JSON.stringify([
          {
            customId: "a",
            intent: "generate",
            targets: ["small.txt"],
            instruction: "x",
          },
        ]),
      );
      if (!deckResult.ok) throw new Error("deck failed");
      const weighing = weighSlices(deckResult.deck, root.root, 100);
      expect(weighing.weights[0]!.bytes).toBe(200);
      expect(weighing.hazards.length).toBe(1);
      expect(weighing.hazards[0]!.cap).toBe(100);
    } finally {
      root.rm();
    }
  });
});
