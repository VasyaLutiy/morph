import { findCard } from "./cardBrief.js";
import type { DebtResult } from "./cardBrief.js";
import { runAcceptance, DEFAULT_TIMEOUT_MS } from "../acceptance/run.js";
import { gitOk } from "../git/run.js";
import { commitPaths } from "../git/commit.js";
import type { Diffstat, Trailer } from "../git/types.js";

export interface AcceptOptions {
  deck: string;
  id: string;
  model: string;
  commit: boolean;
}

export interface AcceptDeps {
  env: Record<string, string>;
  timeoutMs?: number;
}

export interface AcceptDocument {
  deck: string;
  card: string;
  model: string;
  exit: number | null;
  timedOut: boolean;
  green: boolean;
  log: string;
  outside: string[] | null;
  commit: string | null;
  diffstat: Diffstat | null;
  reason: string | null;
}

export function changedOutside(
  root: string,
  targets: string[],
  env: Record<string, string>,
): string[] {
  const output = gitOk(root, ["status", "--porcelain", "--untracked-files=all"], env);
  const outside = new Set<string>();
  for (const line of output.split("\n")) {
    if (line === "") continue;
    let file = line.slice(3);
    const arrow = file.indexOf(" -> ");
    if (arrow !== -1) file = file.slice(arrow + 4);
    if (file.startsWith(".morph/")) continue;
    if (targets.includes(file)) continue;
    outside.add(file);
  }
  return [...outside].sort();
}

export async function acceptCard(
  root: string,
  args: AcceptOptions,
  deps: AcceptDeps,
): Promise<DebtResult> {
  const found = findCard(root, args.deck, args.id);
  if (!found.ok) return found.result;
  const card = found.card;

  if (card.acceptance === null || card.acceptance.trim() === "") {
    return {
      code: 2,
      document: {
        error: {
          code: 2,
          kind: "RefusalError",
          message: `card ${args.id} has no acceptance`,
        },
      },
    };
  }

  let outside: string[] | null = null;
  if (args.commit) {
    outside = changedOutside(root, card.targets, deps.env);
  }

  const result = await runAcceptance(card.acceptance, root, {
    env: deps.env,
    timeoutMs: deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  const green = result.exit === 0;

  const reasons: string[] = [];
  if (!green) {
    reasons.push(`acceptance failed (exit ${String(result.exit)})`);
  }
  if (outside !== null && outside.length > 0) {
    reasons.push(`changed outside the targets: ${outside.join(", ")}`);
  }

  let commit: string | null = null;
  let diffstat: Diffstat | null = null;

  if (args.commit && reasons.length === 0) {
    const subject = `morph ${args.id}: ${card.targets.join(", ")}`;
    const trailers: Trailer[] = [
      ["Morph-Card", args.id],
      ["Morph-Model", args.model],
      ["Morph-Acceptance-Exit", "0"],
      ["Morph-Debt", "true"],
    ];
    const info = commitPaths(root, card.targets, subject, trailers, deps.env, true);
    if (info === null) {
      reasons.push("nothing to commit: the targets equal HEAD");
    } else {
      commit = info.commit;
      diffstat = info.diffstat;
    }
  }

  const document: AcceptDocument = {
    deck: args.deck,
    card: args.id,
    model: args.model,
    exit: result.exit,
    timedOut: result.timedOut,
    green,
    log: result.log,
    outside,
    commit,
    diffstat,
    reason: reasons.length === 0 ? null : reasons.join("; "),
  };

  const code = green && (!args.commit || commit !== null) ? 0 : 1;
  return { code, document };
}
