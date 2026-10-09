// P22b probe for gate-mutants by docs/TASK_P22b_mutants.md §2.2 (src/gate/gateMutants.ts) — the gate's mutants: the killer, the plan, the runs.
// Record Gate Mutants examples 1-3, then rows.
import fs from "node:fs";
import path from "node:path";
import { test, expect } from "vitest";
import { killCommand, planGateMutants, runGateMutants, MUTANT_CAP, MUTANT_STOP_SECONDS } from "../../src/gate/gateMutants.js";
import type { GateMutant, GateMutants, GateMutantSpot } from "../../src/gate/gateMutants.js";
import type { Card } from "../../src/cards/types.js";
import { fixture, fixtureJson, tmpRoot } from "../../tests/helpers.js";

const H = "export const h = (a: number, b: number): boolean => a === b && a > 0;\n";
const files = (): Record<string, string> => fixtureJson("gate/mutantFiles.json") as Record<string, string>;
const want = (k: string): unknown => (fixtureJson("gate/gateMutants.json") as Record<string, unknown>)[k];
const spots = (l: GateMutant[]): GateMutantSpot[] => l.map((g) => ({ card: g.card, path: g.mutant.path, line: g.mutant.line, column: g.mutant.column, rule: g.mutant.rule }));
const card = (id: string, targets: string[], acceptance: string | null = null): Card => ({ customId: id, intent: "generate", targets,
  contextSlice: [], instruction: "w", acceptance, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: [] });
const env = (): Record<string, string> => ({ PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" });
const clock = (step: number): (() => number) => { let t = 0; return () => (t += step); };

test("Gate Mutants example 1: the killer drops the full line and keeps every other line", () => {
  expect(MUTANT_CAP).toBe(30);
  expect(MUTANT_STOP_SECONDS).toBe(1200);
  for (const [name, n] of [["builder/code1.txt", 46], ["builder/go/code1.txt", 33]] as const) {
    const text = fixture(name);
    expect(text.split("\n").length).toBe(n);
    const out = killCommand(text);
    expect(out.split("\n").length).toBe(n - 1);
    expect(out).toBe(text.split("\n").filter((l) => !l.startsWith("echo '== full'")).join("\n"));
  }
  expect(killCommand("a\n echo '== full'; x\nb\necho '== fully'")).toBe("a\nb\necho '== fully'");
});

test("Gate Mutants example 2: code files only, each once, spread to the cap", () => {
  const read = (t: string): string | null => files()[t] ?? null;
  const cards = [card("a", ["src/a.ts", "tests/a.test.ts"]), card("b", ["src/b.ts", "src/a.ts", "src/c.ts"]),
    card("j", ["tests/j.examples.test.ts"]), card("d", ["docs/x.md", "lib/q.go"])];
  expect(spots(planGateMutants([cards[0]], read, 30))).toStrictEqual(want("only a"));
  expect(spots(planGateMutants(cards, read, 2))).toStrictEqual(want("two"));
  expect(spots(planGateMutants(cards, read, 99))).toStrictEqual(want("cap"));
  expect(planGateMutants(cards, read, 0)).toStrictEqual([]);
});

test("Gate Mutants example 3: survivors, the stop time, a red killer, a timeout", async () => {
  const r = tmpRoot();
  try {
    r.write("src/f.ts", H);
    const read = (t: string): string | null => (t === "src/f.ts" ? H : null);
    const f = card("f", ["src/f.ts"], "echo '== probe'\ngrep -q 'a === b' src/f.ts\necho '== full'; exit 7");
    const planned = planGateMutants([f], read, 30);
    expect(await runGateMutants(r.root, [f], planned, { env: env(), now: clock(1000), timeoutMs: 5000 })).toStrictEqual(want("run") as GateMutants);
    expect(await runGateMutants(r.root, [f], planned, { env: env(), now: clock(1000), timeoutMs: 5000, stopSeconds: 3 })).toStrictEqual(want("stop"));
    const g = card("f", ["src/f.ts"], "echo '== probe'\ntest -f ok.txt");
    expect(await runGateMutants(r.root, [g], planned, { env: env(), now: clock(1000), timeoutMs: 5000 })).toStrictEqual(want("baseline"));
    const t = card("f", ["src/f.ts"], "echo '== probe'\nif grep -q 'a !== b' src/f.ts; then sleep 5; fi\ngrep -q 'a' src/f.ts");
    expect(await runGateMutants(r.root, [t], planned, { env: env(), now: clock(1000), timeoutMs: 400 })).toStrictEqual(want("timeout"));
    expect(fs.readFileSync(path.join(r.root, "src/f.ts"), "utf8")).toBe(H);
  } finally {
    r.rm();
  }
}, 120000);

test("rows: an empty acceptance, a planned card that is not in the deck, two groups in first-seen order", async () => {
  expect(killCommand("")).toBe("");
  const r = tmpRoot();
  try {
    r.write("src/f.ts", H);
    r.write("src/g.ts", H);
    const read = (t: string): string | null => (t === "src/f.ts" || t === "src/g.ts" ? H : null);
    const f = card("f", ["src/f.ts"], "echo '== probe'\ngrep -q 'a === b' src/f.ts");
    const g = card("g", ["src/g.ts"], "echo '== probe'\ngrep -q 'a > 0' src/g.ts");
    const planned = planGateMutants([f, g], read, 30);
    expect(planned.map((p) => p.card)).toStrictEqual(["f", "f", "f", "g", "g", "g"]);
    const out = await runGateMutants(r.root, [g], planned, { env: env(), now: clock(1000), timeoutMs: 5000 });
    expect(out.untried.map((u) => u.card + " " + u.column)).toStrictEqual(["f 55", "f 61", "f 66"]);
    expect(out.survivors.map((u) => u.card + " " + u.column)).toStrictEqual(["g 55", "g 61"]);
    expect([out.planned, out.tried, out.killed, out.seconds]).toStrictEqual([6, 3, 1, 5]);
  } finally {
    r.rm();
  }
}, 120000);
