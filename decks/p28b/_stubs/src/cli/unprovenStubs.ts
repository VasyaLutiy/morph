import type { Deck } from "../cards/types.js";

export interface Unproven {
  card: string;
  path: string;
  reason: string;
}

export function unprovenStubs(root: string, deckPath: string, deck: Deck): Unproven[] {
  throw new Error("stub unprovenStubs " + root + deckPath + String(deck.cards.length));
}
