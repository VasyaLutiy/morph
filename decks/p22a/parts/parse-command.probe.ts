// P22a probe for parse-command by docs/TASK_P22a_gate.md §2.2 (src/cli/types.ts, parse.ts, main.ts: Parse Command, Main)
// — `morph gate --deck --stubs --refs` parsed and routed to Gate Command with Read Deck File and Check Builds (issue
// #13). Record Parse Command example 23 and Main example 17, then rows.
import { test, expect } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import { main } from "../../src/cli/main.js";
import type { CliDeps, CliIo } from "../../src/cli/types.js";
import { fixtureJson, tmpRepo, tmpRoot } from "../../tests/helpers.js";

const argv = (k: string): string[][] => (fixtureJson("cli/parseArgv.json") as Record<string, string[][]>)[k];
const parsed = (k: string): unknown[] => (fixtureJson("cli/parse.json") as Record<string, unknown[]>)[k];
function io(): { io: CliIo; out: string[]; err: string[] } { const out: string[] = [], err: string[] = [];
  return { io: { stdout: (t) => { out.push(t); }, stderr: (t) => { err.push(t); } }, out, err }; }
const deps = (): CliDeps => ({ env: { PATH: process.env.PATH ?? "" }, now: () => 0, cwd: "/", transport: null });

test("Parse Command example 23: gate and its flags", () => {
  expect(argv("23").map((a) => parseCommand(a))).toStrictEqual(parsed("23"));
});

test("Main example 17: gate routed to Gate Command through Read Deck File; a parse error before it", async () => {
  const r = tmpRoot();
  try {
    const a = io();
    expect(await main(["gate", "--deck", "nope.json", "--stubs", "s", "--refs", "r", "--root", r.root], deps(), a.io)).toBe(4);
    expect(a.out).toStrictEqual(['{"error":{"code":4,"kind":"UsageError","message":"deck file not found: nope.json"}}\n']);
    expect(a.err).toStrictEqual(["morph gate: exit 4\n"]);
    const b = io();
    expect(await main(["gate", "--deck", "d.json", "--root", r.root], deps(), b.io)).toBe(4);
    expect(b.out).toStrictEqual(['{"error":{"code":4,"kind":"UsageError","message":"missing --stubs"}}\n']);
    expect(b.err).toStrictEqual(["morph: missing --stubs\n"]);
  } finally { r.rm(); }
});

test("rows: a whole gate through main with Check Builds' note; the other commands unchanged", async () => {
  const q = tmpRepo();
  try {
    q.write("d.json", JSON.stringify([{ customId: "x", intent: "generate", targets: ["src/x.txt"], contextSlice: [], instruction: "w",
      acceptance: "echo '== probe'\ngrep -q X1 src/x.txt", model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: [] }]));
    q.write("s/src/x.txt", "s\n"); q.write("f/src/x.txt", "X1\n"); q.git(["add", "-A"]); q.git(["commit", "-q", "-m", "base"]);
    const a = io();
    expect(await main(["gate", "--root", q.root, "--refs", "f", "--stubs", "s", "--deck", "d.json"], deps(), a.io)).toBe(0);
    const doc = JSON.parse(a.out[0]) as { errors: string[]; builds: { note: string }[]; rows: { ok: boolean }[]; maxSeconds: number };
    expect([doc.errors, doc.builds[0].note, doc.rows.map((x) => x.ok), doc.maxSeconds]).toStrictEqual([[], "no language profile claims src/x.txt: not built", [true, true], 0]);
    expect(a.err).toStrictEqual(["morph gate: exit 0\n"]);
    expect(parseCommand(["deck", "check", "--deck", "d"])).toStrictEqual({ ok: true, command: { name: "deck check", root: ".", pretty: false, deck: "d", sliceCapBytes: 500000 } });
    expect(parseCommand([])).toStrictEqual({ ok: false, error: { error: { code: 4, kind: "UsageError",
      message: "no command (commands: deck check, plan, run, submit, collect, primer, scout, review, card, accept, init)" } } });
  } finally { q.rm(); }
});
