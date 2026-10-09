// P22b probe for run-mutants by docs/TASK_P22b_mutants.md §2.2 (src/reviewer/runMutants.ts) — a stop time for the mutant runs.
// Record Run Mutants example 5, then rows.
import fs from "node:fs";
import path from "node:path";
import { test, expect } from "vitest";
import { planMutants } from "../../src/reviewer/planMutants.js";
import { runMutants, runMutantsUntil } from "../../src/reviewer/runMutants.js";
import type { TimedMutantsResult } from "../../src/reviewer/runMutants.js";
import { fixtureJson, tmpRoot } from "../../tests/helpers.js";

const H = "export const h = (a: number, b: number): boolean => a === b && a > 0;\n";
const untried = (k: string): TimedMutantsResult => (fixtureJson("reviewer/untried.json") as Record<string, TimedMutantsResult>)[k];
const clock = (step: number): (() => number) => { let t = 0; return () => (t += step); };

test("Run Mutants example 5: a stop time leaves the later mutants untried; a red baseline leaves them all", async () => {
  const r = tmpRoot();
  try {
    r.write("lib/h.ts", H);
    const mutants = planMutants("lib/h.ts", H, 10);
    const base = { root: r.root, command: 'grep -q "a === b" lib/h.ts', mutants, timeoutMs: 5000, env: { PATH: process.env.PATH ?? "" } };
    expect(await runMutantsUntil({ ...base, now: clock(1000), stopAt: 2500 })).toStrictEqual(untried("stop"));
    expect(await runMutantsUntil({ ...base, now: clock(1000), stopAt: 0 })).toStrictEqual(untried("zero"));
    let calls = 0;
    expect(await runMutantsUntil({ ...base, command: "exit 3", now: () => { calls += 1; return 0; }, stopAt: 99 })).toStrictEqual(untried("red"));
    expect(calls).toBe(0);
    expect(fs.readFileSync(path.join(r.root, "lib/h.ts"), "utf8")).toBe(H);
    expect(Object.keys(await runMutants(base))).toStrictEqual(["baseline", "results", "findings"]);
  } finally {
    r.rm();
  }
}, 120000);

test("rows: no mutant, a stop time never reached equals runMutants plus untried []", async () => {
  const r = tmpRoot();
  try {
    r.write("lib/h.ts", H);
    const mutants = planMutants("lib/h.ts", H, 10);
    const base = { root: r.root, command: 'grep -q "a === b" lib/h.ts', mutants, timeoutMs: 5000, env: { PATH: process.env.PATH ?? "" } };
    expect(await runMutantsUntil({ ...base, mutants: [], now: () => 0, stopAt: 0 })).toStrictEqual({ baseline: { exit: 0, timedOut: false }, results: [], findings: [], untried: [] });
    const plain = await runMutants(base);
    expect(await runMutantsUntil({ ...base, now: clock(1), stopAt: 1000000 })).toStrictEqual({ ...plain, untried: [] });
  } finally {
    r.rm();
  }
}, 120000);
