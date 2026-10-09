// P22b probe for gate-command by docs/TASK_P22b_mutants.md §2.2 (src/gate/playGate.ts, src/gate/gateCommand.ts) — mutants inside the gate.
// Record Gate Command examples 4-5, then rows.
import { test, expect } from "vitest";
import { gateCommand } from "../../src/gate/gateCommand.js";
import type { GateDeps } from "../../src/gate/gateCommand.js";
import type { Card } from "../../src/cards/types.js";
import { readDeckFile } from "../../src/cli/document.js";
import { checkBuilds } from "../../src/cli/checkBuilds.js";
import { fixtureJson, tmpRepo } from "../../tests/helpers.js";
import type { TmpRepo } from "../../tests/helpers.js";

const H = "export const h = (a: number, b: number): boolean => a === b && a > 0;\n";
const result = (k: string): unknown => (fixtureJson("gate/gateCommand.p22b.json") as Record<string, unknown>)[k];
const env = (): Record<string, string> => ({ PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" });
const clock = (step: number): (() => number) => { let t = 0; return () => (t += step); };
const deps = (extra: Partial<GateDeps> = {}): GateDeps => ({ env: env(), now: clock(1000), readDeck: readDeckFile, builds: checkBuilds, ...extra });
const card = (acceptance: string): Card => ({ customId: "a", intent: "generate", targets: ["src/a.ts"], contextSlice: [], instruction: "w",
  acceptance, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: [] });
const A = "echo '== probe'\ngrep -q 'a === b' src/a.ts || { echo 'FAIL probe/a.probe.ts > A example 1'; exit 1; }\necho '== full'; true";
function repo(acceptance: string, ref: string): TmpRepo {
  const r = tmpRepo();
  r.write("d.json", JSON.stringify([card(acceptance)], null, 2) + "\n");
  r.write("s/src/a.ts", "s\n");
  r.write("f/src/a.ts", ref);
  r.git(["add", "-A"]);
  r.git(["commit", "-q", "-m", "base"]);
  return r;
}
const args = { deck: "d.json", stubs: "s", refs: "f" };

test("Gate Command example 4: survivors name card, file and line; the cap, no mutants, the stop time", async () => {
  const r = repo(A, H);
  try {
    expect(await gateCommand(r.root, { ...args, mutants: 30 }, deps())).toStrictEqual(result("mutants"));
    expect(await gateCommand(r.root, { ...args, mutants: 1 }, deps())).toStrictEqual(result("one"));
    expect(await gateCommand(r.root, args, deps())).toStrictEqual(result("off"));
    expect(await gateCommand(r.root, { ...args, mutants: 30 }, deps({ mutantStopSeconds: 0 }))).toStrictEqual(result("stopped"));
    expect(r.git(["status", "--porcelain"])).toBe("");
  } finally {
    r.rm();
  }
}, 120000);

test("Gate Command example 5: red references run no mutant; a killer red without the full line", async () => {
  const r = repo(A, "export const g = (a: number, b: number): boolean => a !== b && a > 0;\n");
  try {
    expect(await gateCommand(r.root, { ...args, mutants: 30 }, deps())).toStrictEqual(result("ref red"));
  } finally {
    r.rm();
  }
  const q = repo("echo '== probe'\ngrep -q 'a === b' src/a.ts || exit 1\necho '== full'; touch full.txt\necho '== own'; test -f full.txt && rm full.txt", H);
  try {
    expect(await gateCommand(q.root, { ...args, mutants: 30 }, deps())).toStrictEqual(result("baseline"));
  } finally {
    q.rm();
  }
}, 120000);

test("rows: a missing file plays nothing and leaves mutants null; above the cap is capped", async () => {
  const r = repo(A, H);
  try {
    const out = (await gateCommand(r.root, { deck: "d.json", stubs: "s", refs: "s/src", mutants: 99 }, deps())) as { code: number; document: { mutants: unknown; errors: string[] } };
    expect([out.code, out.document.mutants, out.document.errors]).toStrictEqual([2, null, ["no reference: src/a.ts"]]);
    const big = (await gateCommand(r.root, { ...args, mutants: 99 }, deps())) as { code: number; document: { mutants: { planned: number } } };
    expect([big.code, big.document.mutants.planned]).toStrictEqual([1, 3]);
  } finally {
    r.rm();
  }
}, 120000);
