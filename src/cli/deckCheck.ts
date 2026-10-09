import { findHazards } from "../cards/hazards.js";
import { layerGenerations } from "../cards/layer.js";
import { weighSlices } from "../cards/weigh.js";
import { checkBuilds } from "./checkBuilds.js";
import { readDeckFile } from "./document.js";
import type { CommandResult, DeckCheckDocument } from "./types.js";

export function deckCheckCommand(
  root: string,
  deckPath: string,
  sliceCapBytes: number,
  env: Record<string, string> = {},
): CommandResult {
  const loaded = readDeckFile(root, deckPath);
  if (!loaded.ok) return loaded.result;

  const weighing = weighSlices(loaded.deck, root, sliceCapBytes);
  const hazards = [...findHazards(loaded.deck), ...weighing.hazards];
  let errors = hazards.filter((h) => h.severity === "error").length;
  let warnings = hazards.filter((h) => h.severity === "warning").length;
  const generations = layerGenerations(loaded.deck);

  const builds = checkBuilds(root, deckPath, loaded.deck, generations, env);
  if (builds !== null) {
    for (const build of builds) {
      errors += build.missing.length + build.breaks.length;
      if (build.note !== null) warnings += 1;
    }
  }

  const document: DeckCheckDocument = {
    deck: deckPath,
    cards: loaded.deck.cards.length,
    generations,
    errors,
    warnings,
    hazards,
    weights: weighing.weights,
  };
  if (builds !== null) document.builds = builds;

  return { code: errors > 0 ? 2 : 0, document };
}
