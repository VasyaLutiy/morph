// P25 probe for main by docs/TASK_P25_config.md §2.2 (src/cli/main.ts) — issue #18 items 2, 4: morph.config.yaml read
// once after root, for every command; an invalid one is exit 2 before any command runs; the scout gets its section,
// a given --deadline beats it. Record Main examples 19, 20; Main 20 (c) (no config) green on main by design.
import { test, expect } from "vitest";
import { main } from "../../src/cli/main.js";
import { DEFAULT_BUDGETS } from "../../src/scout/spendBudget.js";
import { DEFAULT_TOOL_CAPS } from "../../src/scout/runTool.js";
import { tmpRepo, tmpRoot } from "../../tests/helpers.js";
import type { TmpRepo, TmpRoot } from "../../tests/helpers.js";

type Rec = { budgets: { calls: number; deadlineMs: number }; caps: { grepSkip: string[] } };

async function run(t: TmpRepo, s: TmpRoot, argv: string[]): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  const deps = { env: { PATH: process.env.PATH ?? "", MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: s.path("ans") },
    now: () => 1791500000000, cwd: s.root, transport: null };
  const code = await main([...argv, "--root", t.root], deps, { stdout: (x: string) => { out.push(x); }, stderr: (x: string) => { err.push(x); } });
  return { code, out, err };
}

function repo(config: string | null, answer: string): { t: TmpRepo; s: TmpRoot } {
  const t = tmpRepo();
  const s = tmpRoot();
  t.write("README.md", "tiny\n");
  t.write("src/a.ts", "export const a = 1;\n");
  t.git(["add", "."]);
  t.git(["commit", "-q", "-m", "files"]);
  if (config !== null) t.write("morph.config.yaml", config);
  s.write("task.txt", "Make b twice a.\n");
  s.write("ans/scout.t1.md", answer);
  return { t, s };
}

async function scoutRec(config: string | null, extra: string[]): Promise<Rec> {
  const { t, s } = repo(config, "ANSWER {\"targets\": [\"src/a.ts\"]}");
  try {
    const r = await run(t, s, ["scout", "--processor", "s", "--issue", "task.txt", ...extra]);
    expect([r.code, r.err]).toStrictEqual([0, ["morph scout: exit 0\n"]]);
    const doc = JSON.parse(r.out[0]!) as { scout: string };
    return JSON.parse(t.read(doc.scout)) as Rec;
  } finally { s.rm(); t.rm(); }
}

const CFG = "scout:\n  grepSkip: [.morph/, decks/, docs/TASK_]\n  budgets: {calls: 7, deadlineSeconds: 900}\n";

test("Main example 19: an invalid config stops every command before it runs", async () => {
  const { t, s } = repo("version: 1\nscout:\n  grepSkp: []\n  budgets: {calls: \"30\"}\n", "ANSWER {\"targets\": [\"README.md\"]}");
  try {
    const doc = { error: { code: 2, kind: "DeckError", message: "morph.config.yaml is not a valid config (2 problems): scout: unknown key 'grepSkp' (known: grepSkip, budgets, caps, seed); scout.budgets.calls: must be a positive integer" } };
    const a = await run(t, s, ["scout", "--processor", "s", "--issue", "task.txt"]);
    expect([a.code, a.out.map((x) => JSON.parse(x) as unknown), a.err]).toStrictEqual([2, [doc], ["morph scout: exit 2\n"]]);
    const b = await run(t, s, ["primer"]);
    expect([b.code, b.out.map((x) => JSON.parse(x) as unknown), b.err]).toStrictEqual([2, [doc], ["morph primer: exit 2\n"]]);
    expect(t.exists(".morph")).toBe(false);
  } finally { s.rm(); t.rm(); }
}, 60000);

test("Main example 20: the config gives the scout's budgets and grepSkip, the flag beats it", async () => {
  const a = await scoutRec(CFG, ["--deadline", "60"]);
  expect(a.budgets).toStrictEqual({ calls: 7, reads: 12, chars: 120000, rounds: 40, deadlineMs: 60000 });
  expect(a.caps.grepSkip).toStrictEqual([".morph/", "decks/", "docs/TASK_"]);
  const b = await scoutRec(CFG, []);
  expect([b.budgets.deadlineMs, b.budgets.calls, b.caps.grepSkip]).toStrictEqual([900000, 7, [".morph/", "decks/", "docs/TASK_"]]);
}, 60000);

test("Main example 20 (c): no config, no --deadline: the built-in budgets and caps", async () => {
  const c = await scoutRec(null, []);
  expect(c.budgets).toStrictEqual(DEFAULT_BUDGETS);
  expect(c.caps).toStrictEqual(DEFAULT_TOOL_CAPS);
}, 60000);
