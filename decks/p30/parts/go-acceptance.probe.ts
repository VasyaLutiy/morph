// P30 probe for go-acceptance by docs/TASK_P30_rules.md §2.2 (src/builder/goAcceptance.ts) — issue #41: the Go code
// card's guard line carries the record's layers after allowArg; the judge's reads none. Record Go Acceptance example 8.
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

test("Go Acceptance example 8: the layers argument follows allowArg's; a judge has none", () => {
  const code1 = fixture("builder/go/code1.txt");
  expect(goCodeAcceptance(goCtx({ layers: { calc: [] } }), "package calc\n", null, null)).toBe(
    code1.replace(LINE, LINE + " '' '{\"calc\":[]}'"),
  );
  expect(goCodeAcceptance(goCtx({ allowed: ["github.com/dustin/go-humanize"], layers: { calc: ["report"] } }), "package calc\n", null, null)).toBe(
    code1.replace(LINE, LINE + " 'github.com/dustin/go-humanize' '{\"calc\":[\"report\"]}'"),
  );
  const two = goCtx({ id: "a", phase: "p2", targets: ["report/a.go", "report/a_test.go"], siblings: [], frozen: DEFAULT_FROZEN, fullExclude: ["calc/old_test.go"], ownGit: true, layers: { report: ["calc"] } });
  expect(goCodeAcceptance(two, "package report\n", 5, "echo '== bin'; true\n")).toBe(
    fixture("builder/go/code2.txt").replace("guard.mjs src report/a.go; node", "guard.mjs src report/a.go '' '{\"report\":[\"calc\"]}'; node"),
  );
  const files: JudgeFile[] = [{ file: "calc/percent_of_examples_test.go", min: 5, max: 11, lits: ["TestPercentOfExample1", "0% (0 of 0)"], drop: [], new: true }];
  const judge = goCtx({ id: "percent-of-judge", targets: ["calc/percent_of_examples_test.go"], siblings: ["report/format_share.go"], layers: { calc: [] } });
  expect(goJudgeAcceptance(judge, files)).toBe(fixture("builder/go/judge1.txt"));
});
