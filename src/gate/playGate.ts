import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runAcceptance } from "../acceptance/run.js";
import { gitOk } from "../git/run.js";
import { TREE_PROFILES } from "../language/treeProfiles.js";
import { expectedStage, stubVerdict } from "./stubVerdict.js";
import type { Card } from "../cards/types.js";
import type { GatePhase, GateStep } from "./gatePlan.js";

const FILE_LINES: readonly string[] = TREE_PROFILES.map((profile) => profile.fileLine);

export interface PlayRow {
  phase: GatePhase;
  generation: number;
  card: string;
  exit: number | null;
  timedOut: boolean;
  seconds: number;
  stage: string | null;
  expected: string | null;
  outside: string[];
  failures: string[];
  ok: boolean;
}

export interface PlayInput {
  root: string;
  cards: readonly Card[];
  steps: readonly GateStep[];
  stubDir: string;
  refDir: string;
}

export interface PlayDeps {
  env: Record<string, string>;
  now: () => number;
  timeoutMs?: number;
  before?: (scratch: string) => void;
}

function copyTarget(from: string, to: string): void {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

/**
 * Plays a gate plan in a scratch clone of HEAD: a shared, no-checkout clone of
 * `root` under os.tmpdir(), checked out detached at `root`'s committed HEAD —
 * never a worktree, and `root` is never written. Each step puts its stub or
 * reference files over the scratch, runs the owning card's acceptance through
 * Run Acceptance (the environment and the clock are parameters), scores the log
 * with Stub Verdict, and commits a non-empty step's files in the scratch. One
 * row per acceptance run; the base directory is removed in a finally.
 */
export async function playGate(input: PlayInput, deps: PlayDeps): Promise<PlayRow[]> {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "morph-gate-"));
  const scratch = path.join(base, "w");
  try {
    gitOk(input.root, ["clone", "-q", "--shared", "--no-checkout", input.root, scratch], deps.env);
    const head = gitOk(input.root, ["rev-parse", "HEAD"], deps.env).trim();
    gitOk(scratch, ["checkout", "-q", "--detach", head], deps.env);

    const nodeModules = path.join(input.root, "node_modules");
    if (fs.existsSync(nodeModules)) {
      fs.symlinkSync(fs.realpathSync(nodeModules), path.join(scratch, "node_modules"));
      const info = path.join(scratch, ".git", "info");
      fs.mkdirSync(info, { recursive: true });
      fs.appendFileSync(path.join(info, "exclude"), "/node_modules\n");
    }

    deps.before?.(scratch);

    const byId = new Map<string, Card>();
    for (const card of input.cards) {
      byId.set(card.customId, card);
    }

    const rows: PlayRow[] = [];
    for (const step of input.steps) {
      const card = byId.get(step.card);
      if (card === undefined) {
        continue;
      }

      for (const [target, kind] of Object.entries(step.put)) {
        const dir = kind === "stub" ? input.stubDir : input.refDir;
        copyTarget(path.join(dir, target), path.join(scratch, target));
      }

      const acceptance = card.acceptance ?? "";
      const start = deps.now();
      const result = await runAcceptance(acceptance, scratch, {
        env: deps.env,
        timeoutMs: deps.timeoutMs,
      });
      const seconds = Math.round((deps.now() - start) / 100) / 10;

      let stage: string | null;
      let expected: string | null;
      let outside: string[];
      let failures: string[];
      let ok: boolean;

      if (step.phase === "stub") {
        const want = expectedStage(acceptance);
        const verdict = stubVerdict(result.log, want, card.targets, FILE_LINES);
        stage = verdict.stage;
        expected = verdict.expected;
        outside = verdict.outside;
        failures = verdict.failures;
        ok = result.exit !== 0 && verdict.stage === verdict.expected && verdict.outside.length === 0;
      } else {
        const verdict = stubVerdict(result.log, "", card.targets, FILE_LINES, null);
        stage = verdict.stage;
        expected = null;
        outside = verdict.outside;
        failures = verdict.failures;
        ok = result.exit === 0;
      }

      rows.push({
        phase: step.phase,
        generation: step.generation,
        card: step.card,
        exit: result.exit,
        timedOut: result.timedOut,
        seconds,
        stage,
        expected,
        outside,
        failures,
        ok,
      });

      if (step.commit.length > 0) {
        gitOk(scratch, ["add", "-A", "-f", "--", ...step.commit], deps.env);
        gitOk(
          scratch,
          [
            "-c",
            "user.name=morph gate",
            "-c",
            "user.email=gate@morph.invalid",
            "commit",
            "-q",
            "--allow-empty",
            "-m",
            "gate: " + step.card,
          ],
          deps.env,
        );
      }
    }

    return rows;
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
}
