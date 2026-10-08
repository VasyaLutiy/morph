// P17 probe for parse-command by docs/TASK_P17_debt.md §2.2 (src/cli/types.ts, parse.ts, main.ts) — card and accept
// parsed with their flags and checks, the no-command message naming ten commands, and the routing of both through main.
// Record Parse Command examples 8 and 20, Main examples 14 and 15.
import { test, expect } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import { main } from "../../src/cli/main.js";
import type { CliDeps } from "../../src/cli/types.js";
import { fixture, fixtureJson, tmpRepo, tmpRoot } from "../../tests/helpers.js";

const ARGV = fixtureJson("cli/parseArgv.json") as Record<string, string[][]>;
const WANT = fixtureJson("cli/parse.json") as Record<string, unknown[]>;

function parsedAs(key: string): void {
  const got = ARGV[key].map((argv) => parseCommand(argv));
  expect(got.length).toBe(WANT[key].length);
  got.forEach((g, i) => expect([ARGV[key][i], g]).toStrictEqual([ARGV[key][i], WANT[key][i]]));
}

test("Parse Command example 8: --root as the last token, then no command (ten commands)", () => {
  parsedAs("8");
});

test("Parse Command example 20: card and accept, their flags and checks", () => {
  parsedAs("20");
});

function io(): { out: string[]; err: string[]; io: { stdout(t: string): void; stderr(t: string): void } } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { stdout: (t) => { out.push(t); }, stderr: (t) => { err.push(t); } } };
}

test("Main example 14: card routed to the brief, its refusal, a usage error", async () => {
  const t = tmpRoot();
  try {
    t.write("d.json", fixture("debt/deck.json"));
    t.write("src/x.ts", "export const x = 1;\n");
    t.write("docs/a.md", "# A\n");
    t.write("docs/b.md", "B");
    const deps: CliDeps = { env: { PATH: process.env.PATH ?? "" }, now: () => 0, cwd: "/", transport: null };
    const a = io();
    const code = await main(["card", "--deck", "d.json", "--id", "fmt.x", "--md", "--root", t.root, "--pretty"], deps, a.io);
    expect([code, a.err]).toStrictEqual([0, ["morph card: exit 0\n"]]);
    expect(a.out.length).toBe(1);
    expect(a.out[0].startsWith("{\n  \"deck\": \"d.json\",\n  \"card\": \"fmt.x\",\n")).toBe(true);
    const d = JSON.parse(a.out[0]) as { lastRun: unknown; markdown: string };
    expect(d.lastRun).toBe(null);
    expect(d.markdown.startsWith("# Debt brief: fmt.x\n\nWrite only: `src/x.ts`, `src/y.ts`. Change no other file.\n")).toBe(true);
    const b = io();
    expect(await main(["card", "--deck", "d.json", "--id", "zz", "--root", t.root], deps, b.io)).toBe(4);
    expect(b.out).toStrictEqual(["{\"error\":{\"code\":4,\"kind\":\"UsageError\",\"message\":\"no card 'zz' in d.json (have: base, fmt.x, solo)\"}}\n"]);
    expect(b.err).toStrictEqual(["morph card: exit 4\n"]);
    const c = io();
    expect(await main(["card", "--root", t.root, "--deck", "d.json"], deps, c.io)).toBe(4);
    expect(c.err).toStrictEqual(["morph: missing --id\n"]);
  } finally {
    t.rm();
  }
});

test("Main example 15: accept routed to the debt commit; nothing to commit; a bad --model", async () => {
  const t = tmpRepo();
  try {
    t.write("d.json", fixture("debt/accept.deck.json"));
    t.write("src/a.ts", "broken\n");
    t.git(["add", "."]);
    t.git(["commit", "-q", "-m", "base"]);
    t.write("src/a.ts", "fixed\n");
    const deps: CliDeps = { env: { PATH: process.env.PATH ?? "" }, now: () => 0, cwd: t.root, transport: null };
    const argv = ["accept", "--deck", "d.json", "--id", "fix-a", "--model", "claude-fable-5-1", "--commit"];
    const a = io();
    const code = await main(argv, deps, a.io);
    expect([code, a.err]).toStrictEqual([0, ["morph accept: exit 0\n"]]);
    expect(JSON.parse(a.out[0])).toStrictEqual({ deck: "d.json", card: "fix-a", model: "claude-fable-5-1", exit: 0, timedOut: false,
      green: true, log: "", outside: [], commit: t.git(["rev-parse", "HEAD"]), diffstat: { files: 1, insertions: 1, deletions: 1 }, reason: null });
    expect(t.git(["log", "-1", "--format=%B"]).endsWith("Morph-Acceptance-Exit: 0\nMorph-Debt: true")).toBe(true);
    const b = io();
    expect(await main(argv, deps, b.io)).toBe(1);
    const bd = JSON.parse(b.out[0]) as { commit: unknown; reason: unknown };
    expect([bd.commit, bd.reason]).toStrictEqual([null, "nothing to commit: the targets equal HEAD"]);
    expect(b.err).toStrictEqual(["morph accept: exit 1\n"]);
    const c = io();
    expect(await main(["accept", "--deck", "d.json", "--id", "fix-a", "--model", "m x"], deps, c.io)).toBe(4);
    expect(c.err).toStrictEqual(["morph: --model must match ^[A-Za-z0-9._/:-]+$ (got 'm x')\n"]);
  } finally {
    t.rm();
  }
});
