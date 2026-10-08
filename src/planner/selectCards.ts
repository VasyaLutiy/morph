import { orderDeck } from "./plan.js";
import type { Plan } from "./types.js";

export type SelectResult = { ok: true; plan: Plan } | { ok: false; error: string };

export function selectCards(plan: Plan, only: readonly string[]): SelectResult {
  const ids = new Set<string>(plan.cards.map((card) => card.customId));
  const missing = only.filter((id) => !ids.has(id));
  if (missing.length > 0) {
    return {
      ok: false,
      error: "--only names cards the plan does not have: " + missing.join(", "),
    };
  }
  const wanted = new Set<string>(only);
  const cards = plan.cards.filter((card) => wanted.has(card.customId));
  const order = orderDeck(cards);
  if (!order.ok) return { ok: false, error: order.error };
  return {
    ok: true,
    plan: {
      spec: plan.spec,
      components: plan.components,
      cards: order.cards,
      generations: order.generations,
      externalDependsOn: order.externalDependsOn,
    },
  };
}
