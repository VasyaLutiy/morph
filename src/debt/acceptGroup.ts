import * as fs from "node:fs";
import * as path from "node:path";
import { findCard, RUNS_DIR } from "./cardBrief.js";
import type { DebtResult } from "./cardBrief.js";
import { changedOutside } from "./acceptCard.js";
import type { AcceptDeps } from "./acceptCard.js";
import { layerGenerations } from "../cards/layer.js";
import { loadDeck } from "../cards/model.js";
import type { Card } from "../cards/types.js";
import { parseAnswer } from "../compiler/parse.js";
import { snapshotTargets, restoreSnapshot } from "../acceptance/snapshot.js";
import type { TargetSnapshot } from "../acceptance/types.js";
import { runAcceptance, DEFAULT_TIMEOUT_MS } from "../acceptance/run.js";
import { commitPaths } from "../git/commit.js";
import type { Diffstat, Trailer } from "../git/types.js";

export interface GroupOptions {
  deck: string;
  ids: string[];
  model: string | null;
  fromRun: string | null;
  pick: string[];
  commit: boolean;
}

export interface GroupCard {
  card: string;
  variant: string | null;
  model: string;
  exit: number | null;
  timedOut: boolean;
  green: boolean;
  log: string;
  commit: string | null;
  diffstat: Diffstat | null;
  reason: string | null;
}

export interface AcceptGroupDocument {
  deck: string;
  run: string | null;
  cards: GroupCard[];
  outside: string[] | null;
  green: boolean;
  committed: number;
  restored: boolean;
  reason: string | null;
}

interface Work {
  card: Card;
  acceptance: string;
  variant: string | null;
  model: string;
  files: Record<string, string> | null;
}

export async function acceptGroup(
  root: string,
  args: GroupOptions,
  deps: AcceptDeps,
): Promise<DebtResult> {
  // Step 1: every id must be a card of the deck (Card Brief's own failure).
  const cards: Card[] = [];
  for (const id of args.ids) {
    const found = findCard(root, args.deck, id);
    if (!found.ok) return found.result;
    cards.push(found.card);
  }

  // Step 2: every listed card must carry an acceptance.
  for (const card of cards) {
    const acceptance = card.acceptance;
    if (acceptance === null || acceptance.trim() === "") {
      return refusal(`card ${card.customId} has no acceptance`);
    }
  }

  // Step 3: no target may be shared by two listed cards.
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      for (const target of cards[i].targets) {
        if (cards[j].targets.includes(target)) {
          return refusal(
            `target ${target} is in cards ${cards[i].customId} and ${cards[j].customId}`,
          );
        }
      }
    }
  }

  // Order: the deck's generations flattened, kept to the listed ids.
  const loaded = loadDeck(fs.readFileSync(path.resolve(root, args.deck), "utf8"));
  if (!loaded.ok) {
    const message =
      "invalid deck: " + loaded.faults.map((f) => `${f.key}: ${f.message}`).join("; ");
    return refusal(message);
  }
  const idSet = new Set(args.ids);
  const order: string[] = [];
  for (const generation of layerGenerations(loaded.deck)) {
    for (const id of generation) {
      if (idSet.has(id)) order.push(id);
    }
  }

  // Step 4: with --from-run, read the archive; without it the tree is the payer's.
  const works: Work[] = [];
  if (args.fromRun !== null) {
    const dir = RUNS_DIR + "/" + args.fromRun;
    const absDir = path.resolve(root, dir);
    if (!isDirectory(absDir)) {
      return usage(`no run ${args.fromRun} under .morph/runs`);
    }

    const picked = new Map<string, string>();
    for (const p of args.pick) {
      const withoutVariant = p.replace(/\.v[0-9]+$/, "");
      if (withoutVariant === p) {
        return usage(`--pick ${p} names no card of --id`);
      }
      const cardId = withoutVariant.replace(/\.r[0-9]+$/, "");
      if (!idSet.has(cardId)) {
        return usage(`--pick ${p} names no card of --id`);
      }
      if (picked.has(cardId)) {
        return usage(`--pick names ${cardId} twice`);
      }
      picked.set(cardId, p);
    }

    const requests = readRequests(absDir);

    for (const card of cards) {
      const variant = picked.get(card.customId) ?? card.customId + ".v1";
      const model = requestModel(requests, variant);
      if (model === null) {
        return refusal(`no request ${variant} in ${dir}/report.json`);
      }
      const answerPath = dir + "/answers/" + variant + ".answer.txt";
      const answerAbs = path.resolve(root, answerPath);
      if (!isRegularFile(answerAbs)) {
        return refusal(`no answer ${answerPath}`);
      }
      const parsed = parseAnswer(fs.readFileSync(answerAbs, "utf8"), card.targets);
      if ("corrupt" in parsed) {
        return refusal(`answer ${variant} is corrupt: ${parsed.corrupt}`);
      }
      if ("truncated" in parsed) {
        return refusal(`answer ${variant} is truncated`);
      }
      works.push({
        card,
        acceptance: card.acceptance ?? "",
        variant,
        model,
        files: parsed.files,
      });
    }
  } else {
    for (const card of cards) {
      works.push({
        card,
        acceptance: card.acceptance ?? "",
        variant: null,
        model: args.model ?? "",
        files: null,
      });
    }
  }

  const byId = new Map<string, Work>();
  for (const work of works) {
    byId.set(work.card.customId, work);
  }
  const ordered: Work[] = [];
  for (const id of order) {
    const work = byId.get(id);
    if (work !== undefined) ordered.push(work);
  }

  const targets: string[] = [];
  for (const work of ordered) {
    for (const target of work.card.targets) targets.push(target);
  }

  // Step 5: with --commit, list the files changed outside the targets first.
  let outside: string[] | null = null;
  if (args.commit) {
    outside = changedOutside(root, targets, deps.env);
  }

  // Step 6: with --from-run, snapshot the targets and write every parsed file.
  let snapshot: TargetSnapshot | null = null;
  if (args.fromRun !== null) {
    snapshot = snapshotTargets(root, targets);
    for (const work of ordered) {
      if (work.files === null) continue;
      for (const [filePath, text] of Object.entries(work.files)) {
        const abs = path.resolve(root, filePath);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, text);
      }
    }
  }

  // Step 7: every card's acceptance on that one tree, in order; a red one stops nothing.
  const groupCards: GroupCard[] = [];
  for (const work of ordered) {
    const result = await runAcceptance(work.acceptance, root, {
      env: deps.env,
      timeoutMs: deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
    const green = result.exit === 0;
    groupCards.push({
      card: work.card.customId,
      variant: work.variant,
      model: work.model,
      exit: result.exit,
      timedOut: result.timedOut,
      green,
      log: result.log,
      commit: null,
      diffstat: null,
      reason: green ? null : `acceptance failed (exit ${String(result.exit)})`,
    });
  }

  // Step 8: all green, nothing outside, and --commit: one commit per card in order.
  let committed = 0;
  const allGreen = groupCards.every((entry) => entry.green);
  if (allGreen && (outside === null || outside.length === 0) && args.commit) {
    for (let i = 0; i < ordered.length; i++) {
      const work = ordered[i];
      const entry = groupCards[i];
      const subject = `morph ${work.card.customId}: ${work.card.targets.join(", ")}`;
      const trailers: Trailer[] = [
        ["Morph-Card", work.card.customId],
        ["Morph-Model", work.model],
      ];
      if (args.fromRun !== null && work.variant !== null) {
        trailers.push(["Morph-Variant", work.variant]);
        trailers.push(["Morph-Run", args.fromRun]);
      }
      trailers.push(["Morph-Acceptance-Exit", "0"]);
      if (args.fromRun === null) {
        trailers.push(["Morph-Debt", "true"]);
      }
      const info = commitPaths(root, work.card.targets, subject, trailers, deps.env, true);
      if (info === null) {
        entry.reason = "nothing to commit: the targets equal HEAD";
      } else {
        entry.commit = info.commit;
        entry.diffstat = info.diffstat;
        committed += 1;
      }
    }
  }

  // Step 9: with --from-run and no commit made, put the targets back.
  let restored = false;
  if (args.fromRun !== null && committed === 0 && snapshot !== null) {
    restoreSnapshot(snapshot);
    restored = true;
  }

  const red = groupCards.filter((entry) => !entry.green).map((entry) => entry.card);
  const reasonParts: string[] = [];
  if (red.length > 0) {
    reasonParts.push(`red: ${red.join(", ")}`);
  }
  if (outside !== null && outside.length > 0) {
    reasonParts.push(`changed outside the targets: ${outside.join(", ")}`);
  }
  const reason = reasonParts.length === 0 ? null : reasonParts.join("; ");

  const document: AcceptGroupDocument = {
    deck: args.deck,
    run: args.fromRun,
    cards: groupCards,
    outside,
    green: allGreen,
    committed,
    restored,
    reason,
  };

  const ok =
    allGreen &&
    (outside === null || outside.length === 0) &&
    (!args.commit || committed === groupCards.length);

  return { code: ok ? 0 : 1, document };
}

function refusal(message: string): DebtResult {
  return {
    code: 2,
    document: { error: { code: 2, kind: "RefusalError", message } },
  };
}

function usage(message: string): DebtResult {
  return {
    code: 4,
    document: { error: { code: 4, kind: "UsageError", message } },
  };
}

function isRegularFile(abs: string): boolean {
  try {
    return fs.statSync(abs).isFile();
  } catch {
    return false;
  }
}

function isDirectory(abs: string): boolean {
  try {
    return fs.statSync(abs).isDirectory();
  } catch {
    return false;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readRequests(absDir: string): unknown[] {
  const reportPath = path.resolve(absDir, "report.json");
  if (!isRegularFile(reportPath)) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  } catch {
    return [];
  }
  const record = asRecord(parsed);
  if (record === null) return [];
  const requests = record.requests;
  return Array.isArray(requests) ? requests : [];
}

function requestModel(requests: unknown[], variant: string): string | null {
  for (const request of requests) {
    const record = asRecord(request);
    if (record !== null && record.customId === variant && typeof record.model === "string") {
      return record.model;
    }
  }
  return null;
}
