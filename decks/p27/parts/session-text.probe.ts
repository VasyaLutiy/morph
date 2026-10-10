// P27 probe for session-text by docs/TASK_P27_scout.md §2.2 (src/scout/sessionText.ts) — issue #21 items 2, 4, 5, 10, 11:
// the budget sentence and the budget left, the lines not run, the correction after the close, round zero.
// Record Session Text examples 1–3.
import fs from "node:fs";
import { test, expect } from "vitest";
import { tmpRoot } from "../../tests/helpers.js";
import type { ScoutFs } from "../../src/scout/cagePath.js";
import { DEFAULT_BUDGETS } from "../../src/scout/spendBudget.js";
import { ANSWER_SHAPE, ROUND0_HEADER, afterClose, budgetLeft, budgetSentence, notRun, roundZero, taskClues } from "../../src/scout/sessionText.js";

const NODE_FS: ScoutFs = { realpath: (p) => fs.realpathSync(p), readFile: (p) => fs.readFileSync(p, "utf8") };
const Q1 = "Fix `Exited(` when LimitsUnknown is set in a/run.go.\n";

test("Session Text example 1: the budget sentence, the budget left, the lines not run, the correction after the close", () => {
  expect(budgetSentence(DEFAULT_BUDGETS)).toBe("Your budget: 30 tool calls, 12 files read, 120000 characters of tool replies, 40 rounds. When the calls, reads or characters run out you get one last turn: send ANSWER in it; an answer refused there gets one correction.");
  expect(budgetLeft(DEFAULT_BUDGETS, { calls: 2, reads: 1, chars: 50000, rounds: 3 })).toBe("Budget left: 28 calls, 11 file reads, 70000 chars, 37 rounds.");
  expect(budgetLeft(DEFAULT_BUDGETS, { calls: 31, reads: 12, chars: 120086, rounds: 40 })).toBe("Budget left: 0 calls, 0 file reads, 0 chars, 0 rounds.");
  expect(notRun(["LIST b", "GREP x -- src"])).toBe("Not run: LIST b | GREP x -- src. One action line per turn; equal lines count once.");
  expect(ANSWER_SHAPE).toBe("{\"targets\": [...], \"context_slice\": [...], \"reasoning\": \"...\"}");
  const problem = "ANSWER rejected: targets: not in the tree (missing, ignored or a directory): src/c.ts";
  expect(afterClose(problem)).toBe(problem + ". No more tools will run: send ANSWER {\"targets\": [...], \"context_slice\": [...], \"reasoning\": \"...\"} now, every path a file of the tree, the JSON object last.");
});

test("Session Text example 2: the task's clues in order of appearance, at most 8", () => {
  expect(taskClues(Q1)).toStrictEqual(["Exited(", "LimitsUnknown", "a/run.go"]);
  expect(taskClues("Use parseTurn, run_scout and \"the final turn\" in src/scout/runScout.ts; ab_c, `x`, `2026`, LimitsUnknown again"))
    .toStrictEqual(["parseTurn", "run_scout", "the final turn", "src/scout/runScout.ts", "runScout", "ab_c", "LimitsUnknown"]);
  expect(taskClues("AaBb CcDd EeFf GgHh IiJj KkLl MmNn OoPp QqRr")).toStrictEqual(["AaBb", "CcDd", "EeFf", "GgHh", "IiJj", "KkLl", "MmNn", "OoPp"]);
  expect(taskClues("Make b twice a.\n")).toStrictEqual([]);
});

test("Session Text example 3: round zero greps the clues, caps the hits and the characters", () => {
  const p = tmpRoot("morph-p27zero-");
  try {
    p.write(".morph/x.md", "LimitsUnknown\n");
    p.write("a/run.go", "func (s *S) Exited() bool {\n\treturn s.LimitsUnknown\n}\n");
    p.write("b/doc.md", "Exited( here\nExited( " + "z".repeat(250) + "\n");
    p.write("c/many.txt", "LimitsUnknown\n".repeat(22));
    const tree = { root: p.root, files: [".morph/x.md", "a/run.go", "b/doc.md", "c/many.txt"] };
    const skip = [".morph", "decks"];
    const expected = [ROUND0_HEADER, "\"Exited(\": 3 matches in 2 files", "a/run.go:1: func (s *S) Exited() bool {",
      "b/doc.md:1: Exited( here", "b/doc.md:2: Exited( " + "z".repeat(192) + "… (+58 chars)",
      "\"LimitsUnknown\": 23 matches in 2 files", "a/run.go:2: \treturn s.LimitsUnknown",
      ...Array.from({ length: 19 }, (_, i) => `c/many.txt:${i + 1}: LimitsUnknown`), "… 3 more matches",
      "\"a/run.go\": 0 matches in 0 files"].join("\n");
    expect(ROUND0_HEADER).toBe("Round zero: the task's identifiers in the tree, found before your first turn (no budget spent):");
    const full = roundZero(Q1, tree, NODE_FS, skip, 30000);
    expect(full).toBe(expected);
    expect(full.length).toBe(1085);
    expect(roundZero(Q1, tree, NODE_FS, skip, 150)).toBe(ROUND0_HEADER + "\n\"Exited(\": 3 matches in 2 files\n… round zero cut at 150 chars");
    expect(roundZero("Make b twice a.\n", tree, NODE_FS, skip, 30000)).toBe("");
  } finally { p.rm(); }
});
