// src/runloop/deck.ts — Run Deck (TASK_P5 §2.2, steps 1–5; P9b §2.2 runDeck).
//
// Drives a deck generation by generation in the order of layerGenerations,
// with the budget (maxCards, maxRetryBatches, deadline) checked at every
// generation boundary. Failed cards are retried through buildRetry (at most
// two retries per card, batches capped by maxRetryBatches), and each retry
// carries the Retry Context of the failed attempt: its acceptance output and
// its own diff, keyed by the ORIGINAL card id (a later round replaces the
// earlier one). The Run Report is built and RETURNED: nothing is written or
// committed here (the archive and the git commit are P6). The clock, the
// transport and the commit hook are injected through deps, so the loop is
// deterministic and testable.

import { layerGenerations } from "../cards/layer.js";
import { resolveRunnable } from "./resolve.js";
import { processGeneration } from "./generation.js";
import { buildRetry } from "./retry.js";
import type { Card } from "../cards/types.js";
import type { Usage } from "../processor/types.js";
import type {
  CardOutcome,
  CardStatus,
  RequestUsage,
  RetryContext,
  RunDeps,
  RunInput,
  RunResult,
  UsageTotals
} from "./types.js";

function budgetOutcome(customId: string, reason: string): CardOutcome {
  return {
    customId,
    status: "budget-exceeded",
    reason,
    attempts: 0,
    winningVariant: null,
    acceptanceLog: "",
    earlierFailures: [],
    commit: null,
    diffstat: null
  };
}

function originalId(customId: string): string {
  return customId.replace(/\.r[0-9]+$/, "");
}

export async function runDeck(
  input: RunInput,
  deps: RunDeps
): Promise<RunResult> {
  const gens = layerGenerations(input.deck);

  const byId = new Map<string, Card>();
  for (const card of input.deck.cards) byId.set(card.customId, card);

  const done = new Map<string, CardOutcome>();
  const retried = new Map<string, number>();
  const contexts = new Map<string, RetryContext>();
  const requests: RequestUsage[] = [];
  const usage: Usage[] = [];
  let cardsProcessed = 0;
  let retryBatches = 0;

  // generations in order; a budget breach at a boundary marks every
  // not-yet-done card of this and the later generations and stops the run
  for (let g = 0; g < gens.length; g++) {
    const now = deps.now();

    if (now >= input.budget.deadline) {
      for (let h = g; h < gens.length; h++) {
        for (const id of gens[h]) {
          if (!done.has(id)) done.set(id, budgetOutcome(id, "deadline"));
        }
      }
      break;
    }
    if (cardsProcessed >= input.budget.maxCards) {
      const reason = "maxCards " + input.budget.maxCards;
      for (let h = g; h < gens.length; h++) {
        for (const id of gens[h]) {
          if (!done.has(id)) done.set(id, budgetOutcome(id, reason));
        }
      }
      break;
    }

    // the cards of this generation that are not yet decided
    const statusMap: Record<string, CardStatus> = {};
    for (const [id, outcome] of done) statusMap[id] = outcome.status;

    const pending: Card[] = [];
    for (const id of gens[g]) {
      if (done.has(id)) continue;
      const card = byId.get(id);
      if (card !== undefined) pending.push(card);
    }

    const { runnable, skipped } = resolveRunnable(pending, statusMap);
    for (const outcome of skipped) done.set(outcome.customId, outcome);

    if (runnable.length > 0) {
      const generation = await processGeneration(runnable, deps, input.root);
      usage.push(...generation.usage);
      requests.push(...generation.requests);
      for (const outcome of generation.outcomes) {
        done.set(outcome.customId, outcome);
      }
      for (const [id, ctx] of Object.entries(generation.retryContexts)) {
        contexts.set(originalId(id), ctx);
      }
      cardsProcessed += runnable.length;
    }

    // retries: while some card is failed and retried fewer than 2 times,
    // and the batch cap allows it, run one retry batch for all of them
    for (;;) {
      const batch: string[] = [];
      for (const [id, outcome] of done) {
        if (
          outcome.status === "failed" &&
          (retried.get(id) ?? 0) < 2
        ) {
          batch.push(id);
        }
      }
      if (batch.length === 0 || retryBatches >= input.budget.maxRetryBatches) {
        break;
      }
      retryBatches += 1;

      const retryCards: Card[] = [];
      const numbers: number[] = [];
      for (const id of batch) {
        const retryNumber = (retried.get(id) ?? 0) + 1;
        retried.set(id, retryNumber);
        const previous = done.get(id);
        const original = byId.get(id);
        if (previous === undefined || original === undefined) continue;
        const ctx = contexts.get(id);
        if (ctx !== undefined) {
          retryCards.push(
            buildRetry(
              original,
              retryNumber,
              ctx.acceptanceOutput,
              ctx.previousDiff
            )
          );
        } else {
          retryCards.push(
            buildRetry(original, retryNumber, previous.acceptanceLog, null)
          );
        }
        numbers.push(retryNumber);
      }

      const retryGeneration = await processGeneration(
        retryCards,
        deps,
        input.root
      );
      usage.push(...retryGeneration.usage);
      requests.push(...retryGeneration.requests);
      for (const [id, ctx] of Object.entries(retryGeneration.retryContexts)) {
        contexts.set(originalId(id), ctx);
      }

      for (let i = 0; i < retryCards.length; i++) {
        const id = originalId(retryCards[i].customId);
        const retryOutcome = retryGeneration.outcomes[i];
        const previous = done.get(id);
        if (retryOutcome === undefined || previous === undefined) continue;
        const merged: CardOutcome = {
          ...retryOutcome,
          customId: id,
          attempts: numbers[i] + 1,
          earlierFailures: [
            ...previous.earlierFailures,
            previous.acceptanceLog,
            ...retryOutcome.earlierFailures
          ]
        };
        done.set(id, merged);
      }
    }
  }

  // Run Report: outcomes in the deck's card order; usage totals over every
  // usage row the run produced (cost null when no row reported a cost);
  // requests = every row of every processGeneration call, in send order
  const outcomes: CardOutcome[] = [];
  for (const card of input.deck.cards) {
    const outcome = done.get(card.customId);
    if (outcome !== undefined) outcomes.push(outcome);
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let cost: number | null = null;
  for (const u of usage) {
    inputTokens += u.inputTokens;
    outputTokens += u.outputTokens;
    if (u.cost !== null) {
      cost = (cost ?? 0) + u.cost;
    }
  }
  const usageTotals: UsageTotals = {
    inputTokens,
    outputTokens,
    cost,
    requests: usage.length
  };

  return {
    report: {
      runId: input.runId,
      completedAt: deps.now(),
      branch: input.branch,
      processor: deps.config.id,
      generations: gens.length,
      outcomes,
      usageTotals,
      requests
    },
    outcomes
  };
}
