import { layerGenerations } from "./layer.js";
import type { Deck, Hazard } from "./types.js";

export function findHazards(deck: Deck): Hazard[] {
  const generations = layerGenerations(deck);
  const genOf = new Map<string, number>();
  generations.forEach((names: string[], g: number): void => {
    for (const id of names) genOf.set(id, g);
  });
  const byId = new Map<string, (typeof deck.cards)[number]>();
  for (const card of deck.cards) byId.set(card.customId, card);

  const writeWrite: Hazard[] = [];
  const readWrite: Hazard[] = [];
  const unorderedRead: Hazard[] = [];
  const implicitRead: Hazard[] = [];

  // write-write: a path targeted by two or more cards of one generation.
  for (const names of generations) {
    const owners = new Map<string, string[]>();
    for (const id of names) {
      for (const p of byId.get(id)?.targets ?? []) {
        const list = owners.get(p);
        if (list === undefined) owners.set(p, [id]);
        else list.push(id);
      }
    }
    const owned: [string, string[]][] = [];
    for (const card of deck.cards) {
      for (const p of card.targets) {
        const list = owners.get(p);
        if (list !== undefined && list.length >= 2 && !owned.some((o) => o[0] === p)) {
          owned.push([p, list]);
        }
      }
    }
    for (const [p, list] of owned) {
      writeWrite.push({
        kind: "write-write",
        severity: "error",
        cards: list,
        path: p,
        repair: null,
      });
    }
  }

  // read-write and unordered-read: R's slice names a target of W.
  for (const r of deck.cards) {
    for (const slicePath of r.contextSlice) {
      for (const w of deck.cards) {
        if (w.customId === r.customId) continue;
        if (!w.targets.includes(slicePath)) continue;
        const gr = genOf.get(r.customId) ?? 0;
        const gw = genOf.get(w.customId) ?? 0;
        if (gw === gr) {
          readWrite.push({
            kind: "read-write",
            severity: "error",
            cards: [r.customId, w.customId],
            path: slicePath,
            repair: { addDependsOn: { card: r.customId, on: w.customId } },
          });
        } else if (gw > gr) {
          unorderedRead.push({
            kind: "unordered-read",
            severity: "warning",
            cards: [r.customId, w.customId],
            path: slicePath,
            repair: null,
          });
        }
      }
    }
  }

  // implicit-read: a card with an empty contextSlice.
  for (const card of deck.cards) {
    if (card.contextSlice.length === 0) {
      implicitRead.push({
        kind: "implicit-read",
        severity: "warning",
        cards: [card.customId],
        path: null,
        repair: null,
      });
    }
  }

  return [...writeWrite, ...readWrite, ...unorderedRead, ...implicitRead];
}
