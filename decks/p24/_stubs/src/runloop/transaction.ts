// src/runloop/transaction.ts — Run Transaction (TASK_P21c §2.2, Run Transaction;
// Component runloop-subset).
//
// A deck Transaction Deck marks (a card acceptance starting with
// TRANSACTION_MARK) is one subset transaction: Run Deck writes every card
// first (each card's acceptance replaced by "true", a null commit hook), then
// every card's OWN acceptance runs on the full tree (so a card whose
// acceptance names a later card's file sees it written), the owners of the red
// lines are retried to a fixed point (up to 2 retries per card, capped by
// input.budget.maxRetryBatches, each retry carrying the blame of the round and
// its diff against the run's starting tree), and either every card is
// committed (deck order, with the customId of the attempt whose files are on
// the tree) or every target is restored and nothing is committed. A red line
// that names an existing file no card owns is outside the subset: a fault
// naming the whole list of such lines, rolled back. The whole run is
// all-or-nothing: a value thrown after the first commit leaves the committed
// cards written and the rest skipped "fault"; before it, every target is
// restored and every card is skipped "fault". The report is RETURNED.

import * as fs from "node:fs";
import * as path from "node:path";
import { runDeck } from "./deck.js";
import { processGeneration } from "./generation.js";
import { buildRetry } from "./retry.js";
import { blameLog } from "../cards/transaction.js";
import { TREE_PROFILES } from "../language/treeProfiles.js";
import { snapshotTargets, restoreSnapshot } from "../acceptance/snapshot.js";
import { runAcceptance, DEFAULT_TIMEOUT_MS } from "../acceptance/run.js";
import { buildAttemptDiff } from "../acceptance/diff.js";
import type { Blame } from "../cards/transaction.js";
import type { Card } from "../cards/types.js";
import type { TargetSnapshot } from "../acceptance/types.js";
import type { Usage } from "../processor/types.js";
import type {
  CardOutcome,
  CommitInfo,
  RequestUsage,
  RunDeps,
  RunInput,
  RunReport,
  RunResult,
  UsageTotals
} from "./types.js";

interface TxState {
  card: Card;
  wOutcome: CardOutcome;
  attempt: string;            // the customId of the attempt whose files are on the tree
  variant: string | null;     // its winning variant
  retries: number;            // W's retries plus the transaction's own
  wLog: string;               // W's acceptanceLog
  wFailures: string[];        // W's earlierFailures
  redLogs: string[];          // this run's red round logs, in order
  lastLog: string;            // the last round's log (W's when none ran)
  lastRed: boolean;           // the last round was red
  lastBlamesSelf: boolean;    // the last round's Blame names the card itself
  lastOutside: string[];      // the last round's outside lines for this card
}

function skippedFault(customId: string): CardOutcome {
  return {
    customId,
    status: "skipped",
    reason: "fault",
    attempts: 0,
    winningVariant: null,
    acceptanceLog: "",
    earlierFailures: [],
    commit: null,
    diffstat: null
  };
}

/** The attempt's customId: the winning variant without its ".v<n>" suffix. */
function attemptOf(variant: string | null, fallback: string): string {
  if (variant === null) {
    return fallback;
  }
  return variant.replace(/\.v[0-9]+$/, "");
}

/** Every target's text on disk now; "" when the path is absent or not a file. */
function targetTexts(root: string, targets: readonly string[]): Record<string, string> {
  const texts: Record<string, string> = {};
  for (const target of targets) {
    const abs = path.join(root, target);
    const stat = fs.statSync(abs, { throwIfNoEntry: false });
    texts[target] =
      stat !== undefined && stat.isFile() ? fs.readFileSync(abs, "utf8") : "";
  }
  return texts;
}

/** The starting tree's text of every target; null when it was absent. */
function beforeTexts(
  snapshot: TargetSnapshot,
  targets: readonly string[]
): Record<string, string | null> {
  const byPath = new Map<string, string | null>();
  for (const entry of snapshot.entries) {
    byPath.set(
      entry.path,
      entry.bytes === null ? null : Buffer.from(entry.bytes).toString("utf8")
    );
  }
  const out: Record<string, string | null> = {};
  for (const target of targets) {
    out[target] = byPath.get(target) ?? null;
  }
  return out;
}

export async function runTransaction(
  input: RunInput,
  deps: RunDeps
): Promise<RunResult> {
  const cards = input.deck.cards;
  const root = input.root;

  // owners: the first card that targets a path owns it (deck order, first kept)
  const owners: Record<string, string> = {};
  const allTargets: string[] = [];
  const seenTargets = new Set<string>();
  for (const card of cards) {
    for (const target of card.targets) {
      if (!Object.prototype.hasOwnProperty.call(owners, target)) {
        owners[target] = card.customId;
      }
      if (!seenTargets.has(target)) {
        seenTargets.add(target);
        allTargets.push(target);
      }
    }
  }

  // the run's starting tree, restored by every rollback
  const before = snapshotTargets(root, allTargets);

  const states = new Map<string, TxState>();
  const requestRows: RequestUsage[] = [];
  const committedInfo = new Map<string, CommitInfo | null>();
  const committedIds: string[] = [];
  let generations = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cost: number | null = null;
  let fault: string | null = null;
  const outcomes: CardOutcome[] = [];

  const addUsage = (usage: readonly Usage[]): void => {
    for (const row of usage) {
      inputTokens += row.inputTokens;
      outputTokens += row.outputTokens;
      if (row.cost !== null) {
        cost = (cost ?? 0) + row.cost;
      }
    }
  };

  const writtenOutcome = (customId: string): CardOutcome => {
    const state = states.get(customId);
    if (state === undefined) {
      return skippedFault(customId);
    }
    const info = committedInfo.get(customId) ?? null;
    return {
      customId,
      status: "written",
      reason: null,
      attempts: 1 + state.retries,
      winningVariant: state.variant,
      acceptanceLog: state.lastLog,
      earlierFailures: [...state.wFailures, ...state.redLogs],
      commit: info === null ? null : info.commit,
      diffstat: info === null ? null : info.diffstat
    };
  };

  const rollbackOutcome = (customId: string, overBudget: boolean): CardOutcome => {
    const state = states.get(customId);
    if (state === undefined) {
      return skippedFault(customId);
    }
    let reason: string;
    if (state.lastOutside.length > 0) {
      reason = "outside the subset";
    } else if (state.lastRed && state.lastBlamesSelf) {
      reason = "acceptance failed";
    } else {
      reason = "transaction rolled back";
    }
    const earlier = state.lastRed
      ? state.redLogs.slice(0, state.redLogs.length - 1)
      : state.redLogs.slice();
    return {
      customId,
      status: overBudget ? "budget-exceeded" : "failed",
      reason: overBudget ? "deadline" : reason,
      attempts: 1 + state.retries,
      winningVariant: null,
      acceptanceLog: state.lastLog,
      earlierFailures: [...state.wFailures, ...earlier],
      commit: null,
      diffstat: null
    };
  };

  const finish = (list: CardOutcome[], f: string | null): RunResult => {
    const usageTotals: UsageTotals = {
      inputTokens,
      outputTokens,
      cost,
      requests: requestRows.length
    };
    const report: RunReport = {
      runId: input.runId,
      completedAt: deps.now(),
      branch: input.branch,
      processor: deps.config.id,
      generations,
      outcomes: list,
      usageTotals,
      requests: requestRows
    };
    if (f !== null) {
      report.fault = f;
    }
    return { report, outcomes: list };
  };

  try {
    // --- Write: Run Deck itself on the cards with acceptance "true", a null hook
    const wResult = await runDeck(
      {
        ...input,
        deck: {
          cards: cards.map((card) => ({ ...card, acceptance: "true" })),
          externalDependsOn: input.deck.externalDependsOn
        }
      },
      { ...deps, commit: () => null }
    );

    generations = wResult.report.generations;
    inputTokens = wResult.report.usageTotals.inputTokens;
    outputTokens = wResult.report.usageTotals.outputTokens;
    cost = wResult.report.usageTotals.cost;
    for (const row of wResult.report.requests ?? []) {
      requestRows.push(row);
    }

    const wFault = wResult.report.fault ?? null;
    const wById = new Map<string, CardOutcome>();
    for (const outcome of wResult.outcomes) {
      wById.set(outcome.customId, outcome);
    }

    let allWritten = wFault === null;
    for (const card of cards) {
      const outcome = wById.get(card.customId);
      if (outcome === undefined) {
        allWritten = false;
        continue;
      }
      const isWritten = outcome.status === "written";
      if (!isWritten) {
        allWritten = false;
      }
      states.set(card.customId, {
        card,
        wOutcome: outcome,
        attempt: isWritten
          ? attemptOf(outcome.winningVariant, card.customId)
          : card.customId,
        variant: isWritten ? outcome.winningVariant : null,
        retries: outcome.attempts > 1 ? outcome.attempts - 1 : 0,
        wLog: outcome.acceptanceLog,
        wFailures: outcome.earlierFailures.slice(),
        redLogs: [],
        lastLog: outcome.acceptanceLog,
        lastRed: false,
        lastBlamesSelf: false,
        lastOutside: []
      });
    }

    if (!allWritten) {
      // a card W could not write: rollback, no acceptance of the deck runs
      restoreSnapshot(before);
      for (const card of cards) {
        const state = states.get(card.customId);
        if (state === undefined) {
          outcomes.push(skippedFault(card.customId));
        } else if (state.wOutcome.status !== "written") {
          outcomes.push(state.wOutcome);
        } else {
          outcomes.push(rollbackOutcome(card.customId, false));
        }
      }
      return finish(outcomes, wFault);
    }

    // --- Rounds: every card's own acceptance on the full tree
    let batches = 0;
    for (;;) {
      const reds: { log: string; blame: Blame }[] = [];
      for (const card of cards) {
        const state = states.get(card.customId);
        if (state === undefined) {
          continue;
        }
        const result = await runAcceptance(card.acceptance ?? "", root, {
          env: deps.env,
          timeoutMs: deps.acceptanceTimeoutMs ?? DEFAULT_TIMEOUT_MS
        });
        const green = result.exit === 0;
        state.lastLog = result.log;
        state.lastRed = !green;
        if (green) {
          state.lastBlamesSelf = false;
          state.lastOutside = [];
          continue;
        }
        const blame = blameLog(
          result.log,
          card.customId,
          owners,
          TREE_PROFILES.map((profile) => profile.fileLine),
          (p) => fs.existsSync(path.join(root, p))
        );
        state.lastBlamesSelf = blame.cards.includes(card.customId);
        state.lastOutside = blame.outside;
        state.redLogs.push(result.log);
        reds.push({ log: result.log, blame });
      }

      if (reds.length === 0) {
        // all green: commit every card in deck order, with the id of the
        // attempt whose files are on the tree
        for (const card of cards) {
          const state = states.get(card.customId);
          if (state === undefined) {
            continue;
          }
          const info = deps.commit(state.attempt, card.targets);
          committedInfo.set(card.customId, info);
          committedIds.push(card.customId);
        }
        for (const card of cards) {
          outcomes.push(writtenOutcome(card.customId));
        }
        return finish(outcomes, null);
      }

      // some red: an existing file no card owns is outside the subset
      const outside = new Set<string>();
      for (const red of reds) {
        for (const line of red.blame.outside) {
          outside.add(line);
        }
      }
      if (outside.size > 0) {
        fault = "outside the subset: " + Array.from(outside).sort().join(", ");
        restoreSnapshot(before);
        for (const card of cards) {
          outcomes.push(rollbackOutcome(card.customId, false));
        }
        return finish(outcomes, fault);
      }

      // blamed: every id a red Blame names, deck order
      const blamedSet = new Set<string>();
      for (const red of reds) {
        for (const id of red.blame.cards) {
          blamedSet.add(id);
        }
      }
      const blamed: string[] = [];
      for (const card of cards) {
        if (blamedSet.has(card.customId)) {
          blamed.push(card.customId);
        }
      }

      let stop = batches >= input.budget.maxRetryBatches;
      for (const id of blamed) {
        const state = states.get(id);
        if (state !== undefined && state.retries >= 2) {
          stop = true;
        }
      }
      if (stop) {
        restoreSnapshot(before);
        for (const card of cards) {
          outcomes.push(rollbackOutcome(card.customId, false));
        }
        return finish(outcomes, null);
      }

      const signal = deps.interrupted?.() ?? null;
      if (signal !== null) {
        throw new Error("interrupted by " + signal);
      }

      if (deps.now() >= input.budget.deadline) {
        restoreSnapshot(before);
        const blamedNow = new Set(blamed);
        for (const card of cards) {
          outcomes.push(rollbackOutcome(card.customId, blamedNow.has(card.customId)));
        }
        return finish(outcomes, null);
      }

      // --- one retry batch for every blamed card
      batches += 1;
      const retryCards: Card[] = [];
      const retryIds: string[] = [];
      for (const id of blamed) {
        const state = states.get(id);
        if (state === undefined) {
          continue;
        }
        const n = state.retries + 1;
        state.retries = n;
        const parts: string[] = [];
        for (const red of reds) {
          if (red.blame.cards.includes(id)) {
            parts.push(red.log);
          }
        }
        const retryCard = buildRetry(
          state.card,
          n,
          parts.join("\n"),
          buildAttemptDiff(
            beforeTexts(before, state.card.targets),
            targetTexts(root, state.card.targets)
          )
        );
        retryCards.push({ ...retryCard, acceptance: "true" });
        retryIds.push(id);
      }

      const generation = await processGeneration(
        retryCards,
        { ...deps, commit: () => null },
        root
      );
      addUsage(generation.usage);
      for (const row of generation.requests) {
        requestRows.push(row);
      }
      for (let i = 0; i < retryCards.length; i++) {
        const state = states.get(retryIds[i]);
        const outcome = generation.outcomes[i];
        if (state === undefined || outcome === undefined) {
          continue;
        }
        if (outcome.status === "written") {
          state.attempt = retryCards[i].customId;
          state.variant = outcome.winningVariant;
        }
      }
    }
  } catch (value) {
    // a thrown value (an answer write, the interrupt, the commit hook)
    fault = value instanceof Error ? value.message : String(value);
    const committed = new Set(committedIds);
    outcomes.length = 0;
    if (committedIds.length === 0) {
      restoreSnapshot(before);
      for (const card of cards) {
        outcomes.push(skippedFault(card.customId));
      }
    } else {
      for (const card of cards) {
        outcomes.push(
          committed.has(card.customId)
            ? writtenOutcome(card.customId)
            : skippedFault(card.customId)
        );
      }
    }
  }

  return finish(outcomes, fault);
}
