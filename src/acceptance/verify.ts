// src/acceptance/verify.ts — Verify Card (TASK_P3 §2.2, steps 1–3).
//
// Best-of-N over the parsed variants: snapshot the targets once, try each
// variant in order, keep the first green one (its files stay), roll back on
// any other exit. The diff of a failed variant is computed against the
// snapshot BEFORE the rollback, so it shows what the attempt tried. Variants
// run strictly one after another; exit 0 returns at once and no later variant
// is run.

import type { VariantResult, VerifyInput, VerifyOutcome } from "./types.js";
import type { ParsedAnswer } from "../compiler/types.js";
import { restoreSnapshot, snapshotTargets } from "./snapshot.js";
import { runAcceptance } from "./run.js";
import { buildAttemptDiff } from "./diff.js";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Writes every file of a parsed answer's `files` under `root`, creating the
 * parent directories as needed. Corrupt and truncated answers write nothing.
 */
function writeAnswerFiles(
  root: string,
  answer: ParsedAnswer,
): void {
  if (!("files" in answer)) return;
  for (const [p, content] of Object.entries(answer.files)) {
    const abs: string = path.join(root, p);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
  }
}

/**
 * Verifies one card's variants against its acceptance command: the stand-in
 * results for corrupt and truncated answers, the run of the real ones, the
 * early return on the first green variant, and the rolled-back tree after a
 * rejected one. The returned results keep the variants' order.
 */
export async function verifyCard(input: VerifyInput): Promise<VerifyOutcome> {
  const snap = snapshotTargets(input.root, input.targets);
  const before: Record<string, string | null> = {};
  for (const entry of snap.entries) {
    before[entry.path] =
      entry.bytes === null ? null : Buffer.from(entry.bytes).toString("utf8");
  }

  const results: VariantResult[] = [];
  for (const { variant, answer } of input.variants) {
    if ("corrupt" in answer) {
      results.push({
        variant,
        exit: null,
        log: "answer corrupt: " + answer.corrupt,
        diff: null,
      });
      continue;
    }
    if ("truncated" in answer) {
      results.push({
        variant,
        exit: null,
        log: "answer truncated",
        diff: null,
      });
      continue;
    }

    writeAnswerFiles(input.root, answer);
    const r = await runAcceptance(input.command, input.root, {
      env: input.env,
      timeoutMs: input.timeoutMs,
    });

    if (r.exit === 0) {
      results.push({ variant, exit: 0, log: r.log, diff: null });
      return { accepted: { variant }, results };
    }

    const diff: string = buildAttemptDiff(
      before,
      "files" in answer ? answer.files : {}
    );
    results.push({ variant, exit: r.exit, log: r.log, diff });
    restoreSnapshot(snap);
  }

  return { accepted: null, results };
}
