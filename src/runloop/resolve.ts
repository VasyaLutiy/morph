import type { Card } from "../cards/types.js";
import type { CardOutcome, CardStatus } from "./types.js";

export function resolveRunnable(
  cards: Card[],
  done: Record<string, CardStatus>
): { runnable: Card[]; skipped: CardOutcome[] } {
  const runnable: Card[] = [];
  const skipped: CardOutcome[] = [];
  for (const card of cards) {
    let reason: string | null = null;
    for (const dep of card.dependsOn) {
      const status = done[dep];
      if (status !== undefined && status !== "written") {
        reason = "dependency " + dep + " " + status;
        break;
      }
    }
    if (reason === null) {
      runnable.push(card);
    } else {
      skipped.push({
        customId: card.customId,
        status: "skipped",
        reason,
        attempts: 0,
        winningVariant: null,
        acceptanceLog: "",
        earlierFailures: [],
        commit: null,
        diffstat: null
      });
    }
  }
  return { runnable, skipped };
}
