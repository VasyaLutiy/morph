import { runAcceptance } from "../acceptance/run.js";
import { snapshotTargets, restoreSnapshot } from "../acceptance/snapshot.js";
import type { Mutant } from "./planMutants.js";

export interface Finding {
  kind: string;
  source: string;
  path: string | null;
  expected: string;
  got: string;
}

export interface MutantsInput {
  root: string;
  command: string;
  mutants: readonly Mutant[];
  timeoutMs: number;
  env: Record<string, string>;
}

export interface Baseline {
  exit: number | null;
  timedOut: boolean;
}

export interface MutantResult {
  path: string;
  line: number;
  column: number;
  rule: string;
  killed: boolean;
  exit: number | null;
  timedOut: boolean;
}

export interface MutantsResult {
  baseline: Baseline;
  results: MutantResult[];
  findings: Finding[];
}

export const DEFAULT_MUTANT_TIMEOUT_MS = 120000;
export const BASELINE_SOURCE = "mutation baseline";

export function baselineFinding(command: string, baseline: Baseline, timeoutMs: number): Finding {
  return {
    kind: "mutation",
    source: BASELINE_SOURCE,
    path: null,
    expected: "the test command passes before any mutant: " + command,
    got: baseline.timedOut
      ? "timed out after " + String(timeoutMs) + " ms"
      : "exit " + String(baseline.exit),
  };
}

export function survivorFinding(result: MutantResult): Finding {
  return {
    kind: "mutation",
    source: "mutation " + result.path + ":" + String(result.line),
    path: result.path,
    expected: "a test fails on " + result.rule + " at line " + String(result.line),
    got: "every test passed",
  };
}

export async function runMutants(input: MutantsInput): Promise<MutantsResult> {
  const baselineRun = await runAcceptance(input.command, input.root, {
    env: input.env,
    timeoutMs: input.timeoutMs,
  });
  const baseline: Baseline = { exit: baselineRun.exit, timedOut: baselineRun.timedOut };
  if (baselineRun.exit !== 0) {
    return {
      baseline,
      results: [],
      findings: [baselineFinding(input.command, baseline, input.timeoutMs)],
    };
  }
  const results: MutantResult[] = [];
  const findings: Finding[] = [];
  for (const mutant of input.mutants) {
    const snapshot = snapshotTargets(input.root, [mutant.path]);
    try {
      restoreSnapshot({
        root: input.root,
        entries: [{ path: mutant.path, bytes: new TextEncoder().encode(mutant.text) }],
      });
      const run = await runAcceptance(input.command, input.root, {
        env: input.env,
        timeoutMs: input.timeoutMs,
      });
      const result: MutantResult = {
        path: mutant.path,
        line: mutant.line,
        column: mutant.column,
        rule: mutant.rule,
        killed: run.exit !== 0,
        exit: run.exit,
        timedOut: run.timedOut,
      };
      results.push(result);
      if (!result.killed) {
        findings.push(survivorFinding(result));
      }
    } finally {
      restoreSnapshot(snapshot);
    }
  }
  return { baseline, results, findings };
}
