// src/runloop/generation.ts — Process Generation (TASK_P5 §2.2).
//
// compile → send → parse → verify per card. A compile fault or a stale input
// digest discards the answer before any acceptance runs; an accepted card
// fires the injected commit hook. All compiled-ok requests go out in ONE
// sendGeneration call so the config's concurrency pools across the whole
// generation.

import { compileCard } from "../compiler/compile.js";
import { parseAnswer } from "../compiler/parse.js";
import { captureInputs, compareCaptures } from "../compiler/capture.js";
import { sendGeneration } from "../processor/send.js";
import { verifyCard } from "../acceptance/verify.js";
import type { Card } from "../cards/types.js";
import type { InputDigest, Request } from "../compiler/types.js";
import type { VariantAnswer } from "../acceptance/types.js";
import type { CardOutcome, GenerationOutcome, RunDeps } from "./types.js";

interface CompiledCard {
  card: Card;
  requests: Request[];
  inputs: InputDigest;
}

function failedOutcome(
  customId: string,
  reason: string,
  acceptanceLog: string
): CardOutcome {
  return {
    customId,
    status: "failed",
    reason,
    attempts: 1,
    winningVariant: null,
    acceptanceLog,
    earlierFailures: [],
    commit: null,
    diffstat: null
  };
}

export async function processGeneration(
  cards: Card[],
  deps: RunDeps,
  root: string
): Promise<GenerationOutcome> {
  // 1. compile every card; a fault becomes the failed outcome at once
  const compiled: CompiledCard[] = [];
  const compileFailed = new Map<string, CardOutcome>();
  for (const card of cards) {
    const r = compileCard(card, root);
    if (r.ok) {
      compiled.push({ card, requests: r.requests, inputs: r.inputs });
    } else {
      compileFailed.set(
        card.customId,
        failedOutcome(
          card.customId,
          "compile: " + r.faults[0].message,
          r.faults.map((f) => f.message).join("\n")
        )
      );
    }
  }

  // 2. send all compiled-ok requests in ONE call; slice back by index
  const allRequests: Request[] = [];
  const cardStart: number[] = [];
  for (const c of compiled) {
    cardStart.push(allRequests.length);
    allRequests.push(...c.requests);
  }
  const generation = await sendGeneration(deps.config, allRequests, deps.transport);

  // 3. verify each compiled-ok card in card order, so an earlier card's
  // accepted write is on disk before the next card is checked
  const processed: CardOutcome[] = [];
  for (let i = 0; i < compiled.length; i++) {
    const { card, requests, inputs } = compiled[i];
    const start = cardStart[i];
    const answers = generation.answers.slice(start, start + requests.length);

    // stale re-check BEFORE verifyCard: a changed declared input discards
    // the answer unread, and no acceptance is run
    const recomputed = captureInputs(card, root);
    const changed = compareCaptures(inputs, recomputed);
    if (changed.length > 0) {
      processed.push(
        failedOutcome(
          card.customId,
          "stale inputs",
          "stale inputs: " + changed.join(", ")
        )
      );
      continue;
    }

    const variants: VariantAnswer[] = [];
    for (let v = 0; v < requests.length; v++) {
      const answer = answers[v];
      variants.push({
        variant: requests[v].customId,
        answer:
          answer.text === null
            ? { corrupt: answer.error ?? "no text returned" }
            : parseAnswer(answer.text, card.targets)
      });
    }

    const outcome = await verifyCard({
      root,
      targets: card.targets,
      command: card.acceptance ?? "",
      variants,
      env: deps.env,
      timeoutMs: deps.config.timeoutMs
    });

    if (outcome.accepted !== null) {
      const winner = outcome.accepted.variant;
      const winIdx = outcome.results.findIndex((r) => r.variant === winner);
      const commitInfo = deps.commit(card.customId, card.targets);
      processed.push({
        customId: card.customId,
        status: "written",
        reason: null,
        attempts: 1,
        winningVariant: winner,
        acceptanceLog: winIdx >= 0 ? outcome.results[winIdx].log : "",
        earlierFailures: outcome.results
          .slice(0, winIdx >= 0 ? winIdx : 0)
          .map((r) => r.log),
        commit: commitInfo === null ? null : commitInfo.commit,
        diffstat: commitInfo === null ? null : commitInfo.diffstat
      });
    } else {
      const last = outcome.results[outcome.results.length - 1];
      processed.push({
        customId: card.customId,
        status: "failed",
        reason: "acceptance failed",
        attempts: 1,
        winningVariant: null,
        acceptanceLog: last === undefined ? "" : last.log,
        earlierFailures: outcome.results
          .slice(0, outcome.results.length - 1)
          .map((r) => r.log),
        commit: null,
        diffstat: null
      });
    }
  }

  // 4. merge the two paths back into the input card order
  const merged: CardOutcome[] = [];
  let pi = 0;
  for (const card of cards) {
    const failed = compileFailed.get(card.customId);
    if (failed !== undefined) {
      merged.push(failed);
    } else {
      merged.push(processed[pi]);
      pi += 1;
    }
  }

  return { outcomes: merged, usage: generation.usage };
}
