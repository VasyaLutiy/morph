// P15 probe for go-acceptance by docs/TASK_P15_golang.md §2.2 (src/builder/goAcceptance.ts) — the Go code and judge
// scripts byte for byte, the constants and the helpers. Record Go Acceptance examples 1-5, then the §2.2 rows.
import { test, expect } from "vitest";
import {
  GO_ENV, GO_LINT_VERDICT, goCodeAcceptance, goDir, goJudgeAcceptance, goLintSteps, goNamesKept, goPackages,
  goProbePath, goTestStep, overlayJson,
} from "../../src/builder/goAcceptance.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import type { CardContext } from "../../src/builder/types.js";
import type { LanguageProfile } from "../../src/language/types.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

// the heredoc tags, never written whole in a probe (the builder refuses a probe that holds one)
const CONF = ["MORPH", "CONF", "EOF"].join("_");
const PROBE = ["MORPH", "PROBE", "EOF"].join("_");

// the go profile from its fixture: profiles.ts gains GO in the same generation (the probe must not need it)
const GO = fixtureJson("language/go.json") as LanguageProfile;

const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "percent-of", phase: "m1", targets: ["calc/percent_of.go"], siblings: ["calc/clamp_value_examples_test.go"],
  frozen: ["go.mod", "internal"], fullExclude: [], ownGit: false, profile: GO, guard: "// guard\n",
  firstdiff: "// firstdiff\n", ...over,
});

test("Go Acceptance examples 1 and 2: the code scripts byte for byte", () => {
  expect(goCodeAcceptance(ctx({}), "package calc\n", null, null)).toBe(fixture("builder/go/code1.txt"));
  expect(goCodeAcceptance(ctx({ id: "a", phase: "p2", targets: ["report/a.go", "report/a_test.go"], siblings: [],
    frozen: DEFAULT_FROZEN, fullExclude: ["calc/old_test.go"], ownGit: true }), "package report\n", 5,
  "echo '== bin'; true\n")).toBe(fixture("builder/go/code2.txt"));
});

test("Go Acceptance examples 3 and 4: the judge scripts byte for byte", () => {
  expect(goJudgeAcceptance(ctx({ id: "percent-of-judge", targets: ["calc/percent_of_examples_test.go"],
    siblings: ["report/format_share.go"] }), [{ file: "calc/percent_of_examples_test.go", min: 5, max: 11,
    lits: ["TestPercentOfExample1", "0% (0 of 0)"], drop: [], new: true }])).toBe(fixture("builder/go/judge1.txt"));
  expect(goJudgeAcceptance(ctx({ id: "ab-judge", phase: "p3", targets: ["calc/a_examples_test.go", "report/b_examples_test.go"],
    siblings: [], frozen: DEFAULT_FROZEN, fullExclude: ["report/b_examples_test.go"], ownGit: true }), [
    { file: "calc/a_examples_test.go", min: 3, max: 11, lits: ["TestAExample1"], drop: [], new: true },
    { file: "report/b_examples_test.go", min: 4, max: 4, lits: [], drop: ["TestBExample2"], new: false },
  ])).toBe(fixture("builder/go/judge2.txt"));
});

test("Go Acceptance example 5: the steps and helpers", () => {
  expect(goTestStep("-overlay $P/overlay.json ./calc") + goNamesKept("calc/a_examples_test.go", ["TestAExample4", "TestA_old"]) +
    goNamesKept("report/b_test.go", [])).toBe(fixture("builder/go/steps.txt"));
  expect(goPackages(["calc/a.go", "calc/a_test.go", "main.go", "x/y/z.go"])).toStrictEqual(["./calc", ".", "./x/y"]);
  expect(overlayJson(["calc/b.go", "README.md", "x/c_test.go"])).toBe('{"Replace":{"calc/b.go":"","x/c_test.go":""}}\n');
  expect([goProbePath("a", "calc/a.go"), goProbePath("m", "main.go")]).toStrictEqual(["calc/a_probe_test.go", "m_probe_test.go"]);
});

test("rows: the constants, the probe dir, the lint steps, an empty overlay, a root package, no smoke", () => {
  expect(GO_ENV).toBe('export GOFLAGS=-mod=mod GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local GOWORK=off GOCACHE="${GOCACHE:-/tmp/morph/go-build}" GOPATH="${GOPATH:-/tmp/morph/go}"\n');
  expect(GO_LINT_VERDICT).toBe('[ "$E" = 0 ] || { echo "== vet or gofmt failed (see above); every step between it and here passed"; exit 1; }\n');
  expect(overlayJson([])).toBe('{"Replace":{}}\n');
  expect(goPackages(["a/b.go", "a/c.go", "a/b.go"])).toStrictEqual(["./a"]);
  expect(goLintSteps(["q/x.go", "README.md", "q/x_test.go"])).toBe(
    "echo '== vet'; E=0; go vet -overlay $P/overlay.json ./q || E=1\n" +
    "echo '== gofmt'; F=$(gofmt -l q/x.go q/x_test.go 2>&1) || true; [ -z \"$F\" ] || { echo \"gofmt -l lists: $F\"; gofmt -d q/x.go q/x_test.go 2>&1 | head -60; E=1; }\n");
  const dir = goDir("z9", "G\n", "F\n", ["k/a.go", "k/a.md"], ["k/old_test.go"], null);
  expect(dir.split("\n")[0]).toBe("P=$PWD/probe/z9; rm -rf $P; mkdir -p $P; trap 'rm -rf $P' EXIT");
  expect(dir).toContain("cat > $P/overlay.json <<'" + CONF + "'\n{\"Replace\":{\"k/a.go\":\"\"}}\n" + CONF + "\n");
  expect(dir).toContain("cat > $P/full.json <<'" + CONF + "'\n{\"Replace\":{\"k/old_test.go\":\"\"}}\n" + CONF + "\n");
  expect(goDir("z9", "G\n", "F\n", [], [], "k/z9_probe_test.go").split("\n")[0]).toBe("P=$PWD/probe/z9; rm -rf $P; mkdir -p $P; trap 'rm -rf $P k/z9_probe_test.go' EXIT");
  const root = goCodeAcceptance(ctx({ id: "m7", phase: "q4", targets: ["main.go"], siblings: [] }), "package main\n", null, null);
  expect(root).toContain("echo '== build'; go build -overlay $P/overlay.json .\n");
  expect(root).toContain("echo '== probe'; cat > m7_probe_test.go <<'" + PROBE + "'\npackage main\n" + PROBE + "\ngo test -count=1 -overlay $P/overlay.json -run '^TestProbe' . > $P/gt.log");
  expect(root).toContain("\nrm -f m7_probe_test.go\n");
  expect(root.startsWith("D=/tmp/morph/m7-q4; ")).toBe(true);
  expect(root).not.toContain("== own");
  expect(root).not.toContain("== own git");
  const nested = goCodeAcceptance(ctx({ id: "w", targets: ["web/w.go", "web/x/w_test.go"], siblings: [] }), "package web\n", 2, null);
  expect(nested).toContain("; node $P/guard.mjs tests web/x/w_test.go 1 2\n");
  expect(nested).toContain("echo '== own'; go test -count=1 -overlay $P/overlay.json ./web/x > $P/gt.log");
});
