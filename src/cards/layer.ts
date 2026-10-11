import type { Deck } from "./types.js";

export function layerGenerations(deck: Deck): string[][] {
  const byId = new Map<string, string[]>();
  for (const card of deck.cards) byId.set(card.customId, card.dependsOn);

  const generation = new Map<string, number>();
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  const visit = (id: string): number => {
    const done = state.get(id);
    if (done === "done") return generation.get(id) ?? 0;
    if (done === "visiting") {
      const cycle = stack.slice(stack.indexOf(id)).concat(id);
      throw new Error(`dependsOn cycle ${cycle.join(" -> ")}`);
    }
    state.set(id, "visiting");
    stack.push(id);
    let gen = 0;
    for (const dep of byId.get(id) ?? []) {
      if (byId.has(dep)) {
        const d = visit(dep);
        if (d + 1 > gen) gen = d + 1;
      }
    }
    stack.pop();
    state.set(id, "done");
    generation.set(id, gen);
    return gen;
  };

  const generations: string[][] = [];
  for (const card of deck.cards) {
    const gen = visit(card.customId);
    while (generations.length <= gen) generations.push([]);
    generations[gen].push(card.customId);
  }
  return generations.filter((g): g is string[] => g.length > 0);
}
