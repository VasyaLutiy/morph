import { findHazards } from "../cards/hazards.js";
import { layerGenerations } from "../cards/layer.js";
import { weighSlices } from "../cards/weigh.js";
import { readDeckFile } from "./document.js";
import type { CommandResult, DeckCheckDocument } from "./types.js";

export function deckCheckCommand(
  root: string,
  deckPath: string,
  sliceCapBytes: number,
): CommandResult {
  const loaded = readDeckFile(root, deckPath);
  if (!loaded.ok) return loaded.result;

  const weighing = weighSlices(loaded.deck, root, sliceCapBytes);
  const hazards = [...findHazards(loaded.deck), ...weighing.hazards];
  const errors = hazards.filter((h) => h.severity === "error").length;
  const warnings = hazards.filter((h) => h.severity === "warning").length;
  const document: DeckCheckDocument = {
    deck: deckPath,
    cards: loaded.deck.cards.length,
    generations: layerGenerations(loaded.deck),
    errors,
    warnings,
    hazards,
    weights: weighing.weights,
  };
  return { code: errors > 0 ? 2 : 0, document };
}
