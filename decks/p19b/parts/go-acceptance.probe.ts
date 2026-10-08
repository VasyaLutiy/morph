// P19b probe for go-acceptance by docs/TASK_P19b_deps.md §2.2 (src/builder/goAcceptance.ts) — GOFLAGS=-mod=vendor
// exactly when the repository vendors, GOPROXY=off always, the declared module paths on a Go code card's guard line; a
// dependency-free acceptance byte for byte (issue #10). Record Go Acceptance 1, 6, 7, then rows.
import { test, expect } from "vitest";
import { GO_ENV, GO_ENV_VENDOR, goCodeAcceptance, goEnv, goJudgeAcceptance } from "../../src/builder/goAcceptance.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { GO } from "../../src/language/profiles.js";
import type { CardContext, JudgeFile } from "../../src/builder/types.js";
import { fixture } from "../../tests/helpers.js";

const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "percent-of", phase: "m1", targets: ["calc/percent_of.go"], siblings: ["calc/clamp_value_examples_test.go"],
  frozen: ["go.mod", "internal"], fullExclude: [], ownGit: false, profile: GO, guard: "// guard\n", firstdiff: "// firstdiff\n", ...over,
});
const ctx2 = (over: Partial<CardContext>): CardContext => ctx({ id: "a", phase: "p2", targets: ["report/a.go", "report/a_test.go"],
  siblings: [], frozen: DEFAULT_FROZEN, fullExclude: ["calc/old_test.go"], ownGit: true, ...over });
const jctx = (over: Partial<CardContext>): CardContext => ctx({ id: "percent-of-judge", targets: ["calc/percent_of_examples_test.go"],
  siblings: ["report/format_share.go"], ...over });
const JFILES: JudgeFile[] = [{ file: "calc/percent_of_examples_test.go", min: 5, max: 11, lits: ["TestPercentOfExample1", "0% (0 of 0)"], drop: [], new: true }];
const VENDOR_LINE = 'export GOFLAGS=-mod=vendor GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOWORK=off GOCACHE="${GOCACHE:-/tmp/morph/go-build}" GOPATH="${GOPATH:-/tmp/morph/go}"\n';
const once = (text: string, from: string, to: string): string => {
  expect([from, text.split(from).length - 1]).toStrictEqual([from, 1]);
  return text.replace(from, to);
};

test("Go Acceptance example 1: unchanged without allowed and vendor", () => {
  expect(goCodeAcceptance(ctx({}), "package calc\n", null, null)).toBe(fixture("builder/go/code1.txt"));
});

test("Go Acceptance example 6: GO_ENV_VENDOR and goEnv", () => {
  expect(GO_ENV_VENDOR).toBe(VENDOR_LINE);
  expect([goEnv(false), goEnv(true)]).toStrictEqual([GO_ENV, GO_ENV_VENDOR]);
  expect(GO_ENV.replace("-mod=mod", "-mod=vendor")).toBe(GO_ENV_VENDOR);
});

test("Go Acceptance example 7: vendor and the declared module paths in the scripts", () => {
  const code1 = fixture("builder/go/code1.txt");
  expect(goCodeAcceptance(ctx({ allowed: ["github.com/dustin/go-humanize"], vendor: true }), "package calc\n", null, null)).toBe(
    once(once(code1, GO_ENV, VENDOR_LINE), "node $P/guard.mjs src calc/percent_of.go\n", "node $P/guard.mjs src calc/percent_of.go 'github.com/dustin/go-humanize'\n"));
  expect(goJudgeAcceptance(jctx({ allowed: ["golang.org/x/text"], vendor: true }), JFILES))
    .toBe(once(fixture("builder/go/judge1.txt"), GO_ENV, VENDOR_LINE));
  expect(goCodeAcceptance(ctx2({ allowed: ["golang.org/x/mod"] }), "package report\n", 5, "echo '== bin'; true\n"))
    .toBe(once(fixture("builder/go/code2.txt"), "guard.mjs src report/a.go; node", "guard.mjs src report/a.go 'golang.org/x/mod'; node"));
  expect(goCodeAcceptance(ctx({ allowed: [], vendor: false }), "package calc\n", null, null)).toBe(code1);
});

test("row: vendor alone, allowed alone, the judge without vendor, two paths in the order given", () => {
  const code1 = fixture("builder/go/code1.txt");
  expect(goCodeAcceptance(ctx({ vendor: true }), "package calc\n", null, null)).toBe(once(code1, GO_ENV, VENDOR_LINE));
  const a = goCodeAcceptance(ctx({ allowed: ["z.org/b", "a.org/c"] }), "package calc\n", null, null);
  expect(a).toBe(once(code1, "src calc/percent_of.go\n", "src calc/percent_of.go 'z.org/b,a.org/c'\n"));
  expect(goJudgeAcceptance(jctx({ allowed: ["x.org/y"] }), JFILES)).toBe(fixture("builder/go/judge1.txt"));
  expect(goJudgeAcceptance(jctx({ vendor: false }), JFILES).includes("-mod=vendor")).toBe(false);
});
