// P22a probe for play-gate by docs/TASK_P22a_gate.md §2.2 (src/gate/playGate.ts) — a gate's steps played in a scratch
// clone of HEAD: stubs red at their stage, references green, the scratch's own commits, node_modules linked and excluded,
// the repository never touched (issue #13 item 1). Record Play Gate examples 1-3, then rows.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect } from "vitest";
import { playGate } from "../../src/gate/playGate.js";
import type { PlayRow } from "../../src/gate/playGate.js";
import { gatePlan } from "../../src/gate/gatePlan.js";
import { readDeckFile } from "../../src/cli/document.js";
import { layerGenerations } from "../../src/cards/layer.js";
import type { Card } from "../../src/cards/types.js";
import { fixtureJson, fixturePath, tmpRepo } from "../../tests/helpers.js";
import type { TmpRepo } from "../../tests/helpers.js";

const rows = (k: string): PlayRow[] => (fixtureJson("gate/playGate.json") as Record<string, PlayRow[]>)[k];
const env = (): Record<string, string> => ({ PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" });
const clock = (step: number): (() => number) => { let t = 0; return () => (t += step); };
function repo(files: Record<string, string>): TmpRepo { const r = tmpRepo(); for (const [p, t] of Object.entries(files)) r.write(p, t);
  r.git(["add", "-A"]); r.git(["commit", "-q", "-m", "base"]); return r; }
const card = (id: string, targets: string[], acceptance: string | null, dependsOn: string[] = []): Card => ({ customId: id, intent: "generate", targets,
  contextSlice: [], instruction: "w", acceptance, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn });
const state = (r: TmpRepo): string[] => [r.git(["rev-parse", "HEAD"]), r.git(["for-each-ref", "--format=%(refname) %(objectname)"]),
  r.git(["status", "--porcelain"]), r.git(["worktree", "list", "--porcelain"]).split("\n")[0]];
function files(dir: string): string[] { const out: string[] = []; const walk = (a: string, p: string): void => { for (const e of fs.readdirSync(a, { withFileTypes: true })) {
  const rel = p === "" ? e.name : p + "/" + e.name; if (e.isDirectory()) walk(path.join(a, e.name), rel); else out.push(rel); } }; walk(dir, ""); return out.sort(); }

test("Play Gate example 1: three shell cards over two generations in a scratch clone", async () => {
  const cards = [
    card("a", ["src/a.txt"], "echo '== probe'; grep -q A1 src/a.txt || { echo ' FAIL  probe/a.probe.ts > A example 1'; exit 1; }; echo '== frozen'"),
    card("b", ["src/b.txt"], "echo '== tsc'; grep -q B2 src/b.txt || { echo 'src/zz.ts(1,1): error TS2: zz'; exit 2; }\necho '== probe'"),
    card("c", ["tests/c.txt"], "echo '== guard tests/c.txt'; grep -q C3 tests/c.txt || exit 1\necho '== own git'; [ \"$(git log -3 --format=%s | tr '\\n' ,)\" = 'gate: b,gate: a,base,' ]", ["a", "b"]),
  ];
  const r = repo({ "d.json": JSON.stringify(cards), "src/a.txt": "old a\n", "st/src/a.txt": "s\n", "st/src/b.txt": "s\n", "st/tests/c.txt": "s\n",
    "rf/src/a.txt": "A1\n", "rf/src/b.txt": "B2\n", "rf/tests/c.txt": "C3\n" });
  try {
    const before = state(r);
    const t = ["src/a.txt", "src/b.txt", "tests/c.txt"];
    const got = await playGate({ root: r.root, cards, steps: gatePlan(cards, [["a", "b"], ["c"]], t, t).steps, stubDir: r.path("st"), refDir: r.path("rf") },
      { env: env(), now: clock(1000) });
    expect(got).toStrictEqual(rows("shell"));
    expect(state(r)).toStrictEqual(before);
    expect(r.read("src/a.txt")).toBe("old a\n");
  } finally { r.rm(); }
}, 120000);

test("Play Gate example 2: node_modules linked and excluded; the hook sees the scratch, which is gone afterwards", async () => {
  const n = [card("n", ["src/n.txt"], "echo '== probe'; test -L node_modules && test -f node_modules/q/index.js && grep -q N1 src/n.txt && [ -z \"$(git ls-files --others --exclude-standard | grep -vx src/n.txt)\" ]")];
  const r = repo({ "d.json": JSON.stringify(n), ".gitignore": "node_modules/\n", "node_modules/q/index.js": "export {};\n", "st/src/n.txt": "s\n", "rf/src/n.txt": "N1\n" });
  try {
    const seen: string[] = [];
    const got = await playGate({ root: r.root, cards: n, steps: gatePlan(n, [["n"]], ["src/n.txt"], ["src/n.txt"]).steps, stubDir: r.path("st"), refDir: r.path("rf") },
      { env: env(), now: clock(2500), before: (s) => { seen.push(s, String(fs.existsSync(path.join(s, "d.json"))), String(fs.lstatSync(path.join(s, "node_modules")).isSymbolicLink())); } });
    expect(got).toStrictEqual(rows("node_modules"));
    expect(seen.length).toBe(3);
    expect([path.basename(seen[0]), seen[0].startsWith(os.tmpdir()), seen[1], seen[2], fs.existsSync(seen[0])]).toStrictEqual(["w", true, "true", "true", false]);
    expect(r.git(["status", "--porcelain"])).toBe("");
  } finally { r.rm(); }
}, 120000);

test("Play Gate example 3: ts-rename's transaction cut, TypeScript stubs and references", async () => {
  const r = tmpRepo();
  try {
    for (const [p, t] of Object.entries(fixtureJson("ts-rename.json") as Record<string, string>)) r.write(p, t);
    for (const [p, t] of Object.entries(fixtureJson("gate/ts-rename.gate.json") as Record<string, string>)) r.write(p, t);
    for (const f of ["eslint.config.js", "vitest.config.ts", "decks/tools/guard.mjs", "decks/tools/firstdiff.mjs", "decks/tools/layers.json"])
      r.write(f, fs.readFileSync(path.resolve(fixturePath("."), "../../templates/typescript", f), "utf8"));
    r.write(".gitignore", "probe/\nnode_modules\n");
    fs.symlinkSync(path.resolve(fixturePath("."), "../../node_modules"), r.path("node_modules"));
    r.git(["add", "-A"]); r.git(["commit", "-q", "-m", "base"]);
    const l = readDeckFile(r.root, "decks/r1/deck.tx.json"); if (!l.ok) throw new Error("deck");
    const steps = gatePlan(l.deck.cards, layerGenerations(l.deck), files(r.path("decks/r1/_stubs")), files(r.path("decks/r1/_refs"))).steps;
    const got = await playGate({ root: r.root, cards: l.deck.cards, steps, stubDir: r.path("decks/r1/_stubs"), refDir: r.path("decks/r1/_refs") }, { env: env(), now: clock(1000) });
    expect(got).toStrictEqual(rows("ts-rename"));
  } finally { r.rm(); }
}, 120000);

test("rows: an unknown card is skipped, a null acceptance runs as empty, the timeout reaches the run", async () => {
  const cards = [card("z", ["z.txt"], null), card("s", ["s.txt"], "echo '== probe'; echo started; sleep 5; echo late")];
  const r = repo({ "st/z.txt": "s\n", "rf/z.txt": "r\n", "st/s.txt": "s\n", "rf/s.txt": "r\n" });
  try {
    const steps = [{ phase: "stub" as const, generation: 0, card: "nope", put: {}, commit: [] }, ...gatePlan(cards, [["z"], ["s"]], ["s.txt", "z.txt"], ["s.txt", "z.txt"]).steps];
    const got = await playGate({ root: r.root, cards, steps, stubDir: r.path("st"), refDir: r.path("rf") }, { env: env(), now: clock(100), timeoutMs: 700 });
    expect(got.map((g) => [g.phase, g.card, g.exit, g.timedOut, g.stage, g.ok, g.seconds])).toStrictEqual([
      ["stub", "z", 0, false, null, false, 0.1], ["ref", "z", 0, false, null, true, 0.1],
      ["stub", "s", null, true, "probe", true, 0.1], ["ref", "s", null, true, "probe", false, 0.1]]);
  } finally { r.rm(); }
}, 120000);
