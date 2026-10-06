// P1 probe for weigh: weighSlices by docs/TASK_P1_cards.md §2.2, one test per record example,
// values and types. Runs from probe/weigh/ under vitest; the big file lives in a tmpRoot().
import { test, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { weighSlices } from "../../src/cards/weigh.js";
import { loadDeck } from "../../src/cards/model.js";
import type { Deck, Hazard, Weighing } from "../../src/cards/types.js";
import { fixture, tmpRoot } from "../../tests/helpers.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function deck(text: string): Deck {
  const r = loadDeck(text);
  if (!r.ok) throw new Error(r.faults.map((f) => f.message).join("; "));
  return r.deck;
}
const line = (h: Hazard): string =>
  `${h.kind} ${h.severity} [${h.cards.join(",")}] ${h.path} ${JSON.stringify(h.repair)} ${h.bytes} ${h.cap}`;

test("Weigh Slices example 1: 600001 bytes over the default cap", () => {
  const r = tmpRoot();
  try {
    r.write("big.txt", "x".repeat(600001));
    const d = deck('[{"customId":"a","intent":"generate","targets":["big.txt"],"contextSlice":["big.txt"],"instruction":"x"}]');
    const w: Weighing = weighSlices(d, r.root);
    expect(w.hazards.map(line).join(" | "), "one oversized-slice hazard")
      .toBe("oversized-slice warning [a] null null 600001 500000");
    expect(`${w.weights.length} ${w.weights[0]?.card} ${w.weights[0]?.bytes} ${JSON.stringify(w.weights[0]?.missing)}`,
      "weights: the file counted once").toBe("1 a 600001 []");
  } finally {
    r.rm();
  }
});

test("Weigh Slices §2.2: known sizes, missing files count 0, explicit cap", () => {
  const d = deck(fixture("decks/weigh.json"));
  const w = weighSlices(d, ROOT);
  expect(`${w.weights[0]?.bytes} ${JSON.stringify(w.weights[0]?.missing)} ${w.hazards.length}`, "10 + 100 + missing")
    .toBe('110 ["tests/fixtures/weigh/missing.txt"] 0');
  const capped = weighSlices(d, ROOT, 100);
  expect(capped.hazards.map(line).join(" | "), "cap 100").toBe("oversized-slice warning [a] null null 110 100");
  expect(weighSlices(d, ROOT, 110).hazards.length, "bytes == cap is not over").toBe(0);
  const empty = weighSlices({ cards: [], externalDependsOn: [] }, ROOT);
  expect(`${empty.weights.length} ${empty.hazards.length}`, "empty deck").toBe("0 0");
});
