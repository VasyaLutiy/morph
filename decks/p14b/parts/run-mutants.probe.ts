// P14b probe for run-mutants by docs/TASK_P14b_reviewer.md §2.2 (Run Mutants) — each planned mutant written over its
// file through acceptance's snapshot, the test command run by acceptance's runner under its timeout, the file restored in
// finally; a green baseline first, a timeout counts as killed, survivors become mutation findings. Record Run Mutants
// examples 1-4, then the §2.2 rows.
import fs from "node:fs";
import { test, expect } from "vitest";
import {
  BASELINE_SOURCE, DEFAULT_MUTANT_TIMEOUT_MS, baselineFinding, runMutants, survivorFinding,
} from "../../src/reviewer/runMutants.js";
import type { MutantResult, MutantsResult } from "../../src/reviewer/runMutants.js";
import { planMutants } from "../../src/reviewer/planMutants.js";
import { tmpRoot } from "../../tests/helpers.js";

const F = "export function f(a: number, b: number): boolean {\n  return a === b && a > 0;\n}\n";
const PATH_ONLY = { PATH: process.env.PATH ?? "" };
const row = (path: string, column: number, rule: string, killed: boolean, exit: number | null, timedOut = false): MutantResult =>
  ({ path, line: 2, column, rule, killed, exit, timedOut });
const survivor = (path: string, rule: string) => ({ kind: "mutation", source: "mutation " + path + ":2", path,
  expected: "a test fails on " + rule + " at line 2", got: "every test passed" });

test("Run Mutants example 1: baseline green, one mutant killed by the grep, two survivors, the file restored", async () => {
  const p = tmpRoot();
  try {
    p.write("src/f.ts", F);
    const got = await runMutants({ root: p.root, command: 'grep -q "a === b" src/f.ts', mutants: planMutants("src/f.ts", F, 10),
      timeoutMs: 5000, env: PATH_ONLY });
    expect(got).toStrictEqual({
      baseline: { exit: 0, timedOut: false },
      results: [row("src/f.ts", 12, "=== → !==", true, 1), row("src/f.ts", 18, "&& → ||", false, 0), row("src/f.ts", 23, "> → >=", false, 0)],
      findings: [survivor("src/f.ts", "&& → ||"), survivor("src/f.ts", "> → >=")],
    } satisfies MutantsResult);
    expect(p.read("src/f.ts"), "restored").toBe(F);
  } finally {
    p.rm();
  }
});

test("Run Mutants example 2: a red baseline — no mutant runs, one baseline finding", async () => {
  const p = tmpRoot();
  try {
    p.write("src/f.ts", F);
    const command = "echo run >> ran.txt; exit 3";
    const got = await runMutants({ root: p.root, command, mutants: planMutants("src/f.ts", F, 10), timeoutMs: 5000, env: PATH_ONLY });
    expect(got).toStrictEqual({ baseline: { exit: 3, timedOut: false }, results: [], findings: [{ kind: "mutation",
      source: "mutation baseline", path: null, expected: "the test command passes before any mutant: " + command, got: "exit 3" }] });
    expect(p.read("ran.txt"), "only the baseline ran").toBe("run\n");
    expect(p.read("src/f.ts")).toBe(F);
  } finally {
    p.rm();
  }
});

test("Run Mutants example 3: a mutant that hangs is killed by the timeout; a baseline that hangs is a finding", async () => {
  const p = tmpRoot();
  try {
    p.write("lib/g.ts", F);
    const got = await runMutants({ root: p.root, command: 'if grep -q "a !== b" lib/g.ts; then sleep 5; fi',
      mutants: planMutants("lib/g.ts", F, 10), timeoutMs: 400, env: PATH_ONLY });
    expect(got.baseline).toStrictEqual({ exit: 0, timedOut: false });
    expect(got.results).toStrictEqual([row("lib/g.ts", 12, "=== → !==", true, null, true), row("lib/g.ts", 18, "&& → ||", false, 0),
      row("lib/g.ts", 23, "> → >=", false, 0)]);
    expect(got.findings).toStrictEqual([survivor("lib/g.ts", "&& → ||"), survivor("lib/g.ts", "> → >=")]);
    expect(p.read("lib/g.ts")).toBe(F);
    const hung = await runMutants({ root: p.root, command: "sleep 5", mutants: planMutants("lib/g.ts", F, 10), timeoutMs: 300, env: PATH_ONLY });
    expect(hung).toStrictEqual({ baseline: { exit: null, timedOut: true }, results: [], findings: [{ kind: "mutation",
      source: "mutation baseline", path: null, expected: "the test command passes before any mutant: sleep 5", got: "timed out after 300 ms" }] });
  } finally {
    p.rm();
  }
});

test("Run Mutants example 4: the env reaches the command without its keys; no mutant; an absent file is absent again", async () => {
  const p = tmpRoot();
  try {
    const command = 'test "$MARK" = m1 && test -z "$OPENAI_API_KEY"';
    const ok = await runMutants({ root: p.root, command, mutants: [], timeoutMs: 5000, env: { ...PATH_ONLY, MARK: "m1", OPENAI_API_KEY: "k" } });
    expect(ok).toStrictEqual({ baseline: { exit: 0, timedOut: false }, results: [], findings: [] });
    const red = await runMutants({ root: p.root, command, mutants: [], timeoutMs: 5000, env: { ...PATH_ONLY, MARK: "m2" } });
    expect(red.findings.map((f) => f.got)).toStrictEqual(["exit 1"]);
    const made = await runMutants({ root: p.root, command: "true", mutants: [{ path: "gen/new.ts", line: 1, column: 1, rule: "true → false", text: "x\n" }],
      timeoutMs: 5000, env: PATH_ONLY });
    expect(made.results).toStrictEqual([{ path: "gen/new.ts", line: 1, column: 1, rule: "true → false", killed: false, exit: 0, timedOut: false }]);
    expect(made.findings).toStrictEqual([{ kind: "mutation", source: "mutation gen/new.ts:1", path: "gen/new.ts",
      expected: "a test fails on true → false at line 1", got: "every test passed" }]);
    expect(p.exists("gen/new.ts"), "absent again").toBe(false);
  } finally {
    p.rm();
  }
});

test("§2.2 rows: constants and the two finding builders; the mutant's text is what the command sees; MORPH_PROCESSOR_ keys stripped", async () => {
  expect([DEFAULT_MUTANT_TIMEOUT_MS, BASELINE_SOURCE]).toStrictEqual([120000, "mutation baseline"]);
  expect(baselineFinding("c", { exit: null, timedOut: false }, 7)).toStrictEqual({ kind: "mutation", source: "mutation baseline",
    path: null, expected: "the test command passes before any mutant: c", got: "exit null" });
  expect(baselineFinding("c", { exit: null, timedOut: true }, 7).got).toBe("timed out after 7 ms");
  expect(survivorFinding({ path: "q.ts", line: 9, column: 4, rule: "r", killed: false, exit: 0, timedOut: false })).toStrictEqual({
    kind: "mutation", source: "mutation q.ts:9", path: "q.ts", expected: "a test fails on r at line 9", got: "every test passed" });
  const p = tmpRoot();
  try {
    const T = "const t = true;\nconst u = a > b;\n";
    p.write("m.ts", T);
    const got = await runMutants({ root: p.root, command: 'cat m.ts >> seen.txt; test -z "$MORPH_PROCESSOR_Q_TYPE"',
      mutants: planMutants("m.ts", T, 9), timeoutMs: 5000, env: { ...PATH_ONLY, MORPH_PROCESSOR_Q_TYPE: "stub" } });
    expect(got.results.map((r) => [r.line, r.rule, r.killed])).toStrictEqual([[1, "true → false", false], [2, "> → >=", false]]);
    expect(p.read("seen.txt"), "baseline, mutant 1, mutant 2").toBe(T + "const t = false;\nconst u = a > b;\n" + "const t = true;\nconst u = a >= b;\n");
    expect(fs.readFileSync(p.path("m.ts"), "utf8")).toBe(T);
  } finally {
    p.rm();
  }
});
