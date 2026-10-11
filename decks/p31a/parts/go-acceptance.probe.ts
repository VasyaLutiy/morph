// P31a probe for go-acceptance by docs/TASK_P31a_guardrails.md §2.2 (src/builder/goAcceptance.ts) — issue #42: the Go
// code card's guard line carries the record's rules after the layers; the judge's reads none. Record Go Acceptance 9.
import { test, expect } from "vitest";
import { goCodeAcceptance, goJudgeAcceptance } from "../../src/builder/goAcceptance.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { GO } from "../../src/language/profiles.js";
import { fixture } from "../../tests/helpers.js";
import type { CardContext, JudgeFile } from "../../src/builder/types.js";

const goCtx = (over: Partial<CardContext>): CardContext => ({
  id: "percent-of", phase: "m1", targets: ["calc/percent_of.go"], siblings: ["calc/clamp_value_examples_test.go"],
  frozen: ["go.mod", "internal"], fullExclude: [], ownGit: false, profile: GO, guard: "// guard\n", firstdiff: "// firstdiff\n", ...over,
});
const LINE = "echo '== guard'; node $P/guard.mjs src calc/percent_of.go";

test("Go Acceptance example 9: the rules argument follows the layers argument; a judge has none", () => {
  expect(goCodeAcceptance(goCtx({ layers: { calc: [] }, rules: { calc: { "no-shell": "Guardrail 'No Shell' of System mini" } } }), "package calc\n", null, null)).toBe(
    fixture("builder/go/code1.txt").replace(LINE, LINE + " '' '{\"calc\":[]}' '{\"calc\":{\"no-shell\":\"Guardrail \\u0027No Shell\\u0027 of System mini\"}}'"),
  );
  const two = goCtx({ id: "a", phase: "p2", targets: ["report/a.go", "report/a_test.go"], siblings: [], frozen: DEFAULT_FROZEN, fullExclude: ["calc/old_test.go"], ownGit: true, layers: { report: ["calc"] }, rules: { report: {} } });
  expect(goCodeAcceptance(two, "package report\n", 5, "echo '== bin'; true\n")).toBe(
    fixture("builder/go/code2.txt").replace("guard.mjs src report/a.go; node", "guard.mjs src report/a.go '' '{\"report\":[\"calc\"]}' '{\"report\":{}}'; node"),
  );
  const files: JudgeFile[] = [{ file: "calc/percent_of_examples_test.go", min: 5, max: 11, lits: ["TestPercentOfExample1", "0% (0 of 0)"], drop: [], new: true }];
  const judge = goCtx({ id: "percent-of-judge", targets: ["calc/percent_of_examples_test.go"], siblings: ["report/format_share.go"], layers: { calc: [] }, rules: { calc: {} } });
  expect(goJudgeAcceptance(judge, files)).toBe(fixture("builder/go/judge1.txt"));
});
