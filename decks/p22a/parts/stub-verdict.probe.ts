// P22a probe for stub-verdict by docs/TASK_P22a_gate.md §2.2 (src/gate/stubVerdict.ts) — where a gate's acceptance log
// stopped and which compile lines name a file outside the card's targets (issue #13 item 1, the rule of stubcheck.mjs;
// the patterns are Tree Profiles' fileLine). Record Stub Verdict examples 1-3, then rows.
import fs from "node:fs";
import { test, expect } from "vitest";
import { expectedStage, stubVerdict } from "../../src/gate/stubVerdict.js";
import type { StubVerdict } from "../../src/gate/stubVerdict.js";
import { TREE_PROFILES } from "../../src/language/treeProfiles.js";
import { fixture, fixtureJson, fixturePath } from "../../tests/helpers.js";

const FL = TREE_PROFILES.map((p) => p.fileLine);
const logs = (): Record<string, string> => fixtureJson("gate/stubLogs.json") as Record<string, string>;
const want = (k: string): StubVerdict => (fixtureJson("gate/verdicts.json") as Record<string, StubVerdict>)[k];

test("Stub Verdict example 1: a code card stops at its probe, a judge at its guard", () => {
  const tx = JSON.parse(fs.readFileSync(fixturePath("go-p7b/decks/b1/deck.p21c.json"), "utf8")) as { acceptance: string }[];
  expect([fixture("builder/go/code1.txt"), fixture("builder/go/judge1.txt"), tx[0].acceptance, "", "  echo '== probe'; exit 1"].map(expectedStage))
    .toStrictEqual(["probe", "guard", "probe", "guard", "guard"]);
});

test("Stub Verdict example 2: real Go and TypeScript stub logs", () => {
  const l = logs();
  expect(stubVerdict(l["go probe"], "probe", ["control/control.go"], FL)).toStrictEqual(want("go probe"));
  expect(stubVerdict(l["go judge"], "guard", ["control/control_examples_test.go"], FL)).toStrictEqual(want("go judge"));
  expect(stubVerdict(l["go vet outside"], "probe", ["supervisor/guard.go"], FL)).toStrictEqual(want("go vet outside"));
  expect(stubVerdict(l["ts tsc"], "probe", ["src/units/convert.ts"], FL)).toStrictEqual(want("ts tsc"));
  expect(stubVerdict(l["ts probe"], "probe", ["src/units/convert.ts"], FL)).toStrictEqual(want("ts probe"));
});

test("Stub Verdict example 3: the held verdict, own files, continuations, every stage, no pattern, no header", () => {
  const l = logs();
  expect(stubVerdict(l["mixed"], "probe", ["b/b.go", "src/own.ts"], FL)).toStrictEqual(want("mixed"));
  expect(stubVerdict(l["mixed"], "probe", ["b/b.go", "src/own.ts"], FL, null)).toStrictEqual(want("mixed, every stage"));
  expect(stubVerdict(l["mixed"], "probe", ["b/b.go", "src/own.ts"], [])).toStrictEqual(want("mixed, no pattern"));
  expect(stubVerdict(l["none"], "probe", [], FL)).toStrictEqual(want("none"));
});

test("row: the first matching pattern decides, a line counts once, stage lists are taken as given", () => {
  const log = "== vet\npkg/q.go:3:7: a\npkg/q.go:3:7: a\n== lint\nsrc/a.ts(1,1): b\n== probe\n--- FAIL: TestX (0.00s)\nFAIL ok\n";
  expect(stubVerdict(log, "probe", [], FL, ["lint"])).toStrictEqual({ stage: "probe", expected: "probe", outside: ["src/a.ts(1,1): b"], failures: ["--- FAIL: TestX (0.00s)", "FAIL ok"] });
  expect(stubVerdict(log, "lint", ["pkg/q.go"], ["^(\\S+?\\.go)(:.*)$", "^(\\S+)(.*)$"])).toStrictEqual({ stage: "probe", expected: "lint", outside: [], failures: [] });
  expect(stubVerdict("== tsc\n\nsrc/a.ts(1,1): b\n== guard x\n", "guard", ["src/b.ts"], FL).stage).toBe("guard");
});
