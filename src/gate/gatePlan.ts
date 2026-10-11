import { isTransactionDeck } from "../cards/transaction.js";
import type { Card } from "../cards/types.js";

export type GatePhase = "stub" | "ref" | "retry";

export interface GateStep {
  phase: GatePhase;
  generation: number;
  card: string;
  put: Record<string, "stub" | "ref">;
  commit: string[];
}

export interface GatePlan {
  transaction: boolean;
  steps: GateStep[];
  missing: string[];
}

interface Entry {
  card: Card;
  generation: number;
}

function pushOnce(list: string[], seen: Set<string>, value: string): void {
  if (seen.has(value)) return;
  seen.add(value);
  list.push(value);
}

function targetsOf(cards: readonly Entry[]): string[] {
  const all: string[] = [];
  const seen = new Set<string>();
  for (const entry of cards) {
    for (const target of entry.card.targets) {
      if (!seen.has(target)) {
        seen.add(target);
        all.push(target);
      }
    }
  }
  return all;
}

export function gatePlan(
  cards: readonly Card[],
  generations: string[][],
  stubs: readonly string[],
  refs: readonly string[],
): GatePlan {
  const transaction = isTransactionDeck(cards);

  const byId = new Map<string, Card>();
  for (const card of cards) {
    byId.set(card.customId, card);
  }

  const order: Entry[] = [];
  for (let g = 0; g < generations.length; g++) {
    for (const id of generations[g]) {
      const card = byId.get(id);
      if (card !== undefined) {
        order.push({ card, generation: g });
      }
    }
  }

  const stubSet = new Set(stubs);
  const refSet = new Set(refs);
  const missing: string[] = [];
  const missingSeen = new Set<string>();
  for (const entry of order) {
    for (const target of entry.card.targets) {
      if (!stubSet.has(target)) pushOnce(missing, missingSeen, "no stub: " + target);
      if (!refSet.has(target)) pushOnce(missing, missingSeen, "no reference: " + target);
    }
  }

  if (missing.length > 0) {
    return { transaction, steps: [], missing };
  }

  const steps: GateStep[] = [];

  if (transaction) {
    const all = targetsOf(order);

    for (let i = 0; i < order.length; i++) {
      const entry = order[i];
      const put: Record<string, "stub" | "ref"> = {};
      if (i === 0) {
        for (const target of all) put[target] = "stub";
      }
      steps.push({ phase: "stub", generation: entry.generation, card: entry.card.customId, put, commit: [] });
    }

    for (let i = 0; i < order.length; i++) {
      const entry = order[i];
      const put: Record<string, "stub" | "ref"> = {};
      if (i === 0) {
        for (const target of all) put[target] = "ref";
      }
      const commit = i === order.length - 1 ? all.slice() : [];
      steps.push({ phase: "ref", generation: entry.generation, card: entry.card.customId, put, commit });
    }

    return { transaction, steps, missing };
  }

  for (let g = 0; g < generations.length; g++) {
    const entries = order.filter((entry) => entry.generation === g);
    if (entries.length === 0) continue;

    for (const entry of entries) {
      const stubPut: Record<string, "stub" | "ref"> = {};
      for (const target of entry.card.targets) stubPut[target] = "stub";
      steps.push({
        phase: "stub",
        generation: g,
        card: entry.card.customId,
        put: stubPut,
        commit: [],
      });

      const refPut: Record<string, "stub" | "ref"> = {};
      for (const target of entry.card.targets) refPut[target] = "ref";
      steps.push({
        phase: "ref",
        generation: g,
        card: entry.card.customId,
        put: refPut,
        commit: entry.card.targets.slice(),
      });
    }

    if (entries.length >= 2) {
      for (const entry of entries) {
        steps.push({
          phase: "retry",
          generation: g,
          card: entry.card.customId,
          put: {},
          commit: [],
        });
      }
    }
  }

  return { transaction, steps, missing };
}
