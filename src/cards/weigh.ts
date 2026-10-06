import { statSync } from "node:fs";
import path from "node:path";
import type { Deck, Hazard, SliceWeight, Weighing } from "./types.js";

export function weighSlices(deck: Deck, root: string, cap = 500000): Weighing {
  const weights: SliceWeight[] = [];
  const hazards: Hazard[] = [];
  for (const card of deck.cards) {
    const files: string[] = [];
    const seen = new Set<string>();
    for (const file of [...card.contextSlice, ...card.targets]) {
      if (!seen.has(file)) {
        seen.add(file);
        files.push(file);
      }
    }
    let bytes = 0;
    const missing: string[] = [];
    for (const file of files) {
      const abs = path.join(root, file);
      let isFile = false;
      let size = 0;
      try {
        const st = statSync(abs);
        if (st.isFile()) {
          isFile = true;
          size = st.size;
        }
      } catch {
        isFile = false;
      }
      if (isFile) bytes += size;
      else missing.push(file);
    }
    weights.push({ card: card.customId, bytes, missing });
    if (bytes > cap) {
      const hazard: Hazard = {
        kind: "oversized-slice",
        severity: "warning",
        cards: [card.customId],
        path: null,
        repair: null,
        bytes,
        cap,
      };
      hazards.push(hazard);
    }
  }
  return { weights, hazards };
}
