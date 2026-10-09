// P22a probe for gate-command by docs/TASK_P22a_gate.md §2.2 (src/gate/gateCommand.ts) — `morph gate`: the P21a cut's
// retry red that the hand gate missed, a transaction and planted stubs, refusals, missing files, the 250 s chain limit (issue #13
// item 1). Record Gate Command examples 1-3, then rows.
import fs from "node:fs";
import { test, expect } from "vitest";
import { gateCommand, CHAIN_LIMIT_SECONDS } from "../../src/gate/gateCommand.js";
import type { GateDeps } from "../../src/gate/gateCommand.js";
import { readDeckFile } from "../../src/cli/document.js";
import { checkBuilds } from "../../src/cli/checkBuilds.js";
import { fixtureJson, fixturePath, tmpRepo } from "../../tests/helpers.js";
import type { TmpRepo } from "../../tests/helpers.js";

type Result = { code: number; document: unknown };
const want = (k: string): Result => (fixtureJson("gate/gateCommand.json") as Record<string, Result>)[k];
const clock = (step: number): (() => number) => { let t = 0; return () => (t += step); };
const deps = (step = 1000): GateDeps => ({ env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" }, now: clock(step), readDeck: readDeckFile, builds: checkBuilds });
function p7b(): TmpRepo { const r = tmpRepo(); fs.cpSync(fixturePath("go-p7b"), r.root, { recursive: true }); r.git(["add", "-A"]); r.git(["commit", "-q", "-m", "base"]); return r; }
const B1 = { deck: "decks/b1/deck.p21.json", stubs: "decks/b1/_stubs", refs: "decks/b1/_refs" };

test("Gate Command example 1: go-p7b's P21a cut, the retry after a sibling names supervisor/guard.go:20:23", async () => {
  const r = p7b();
  try {
    expect(await gateCommand(r.root, B1, deps())).toStrictEqual(want("p21"));
    expect(r.git(["status", "--porcelain"])).toBe("");
  } finally { r.rm(); }
}, 120000);

const M = "# morph: subset transaction\n";
test("Gate Command example 2: a transaction of two shell cards; planted stubs are named", async () => {
  const cards = [{ customId: "t1", targets: ["src/t1.txt"], dependsOn: [] as string[],
    acceptance: M + "echo '== probe'\ngrep -q T1 src/t1.txt || { echo 'FAIL probe/t1.probe.ts > T1 example 1'; exit 1; }" },
  { customId: "t2", targets: ["src/t2.txt"], dependsOn: ["t1"],
    acceptance: M + "echo '== tsc'\n! grep -q BROKEN src/t2.txt || { echo 'lib/old.ts(3,4): error TS2304: Cannot find name q7.'; exit 2; }\necho '== probe'\ngrep -q T1 src/t1.txt && grep -q T2 src/t2.txt" }]
    .map((c) => ({ intent: "generate", contextSlice: [], instruction: "w", model: null, maxTokens: null, reasoning: null, variants: 1, ...c }));
  const q = tmpRepo();
  try {
    q.write("d.json", JSON.stringify(cards));
    for (const [p, t] of Object.entries({ "s/src/t1.txt": "s\n", "s/src/t2.txt": "s\n", "f/src/t1.txt": "T1\n", "f/src/t2.txt": "T2\n", "s2/src/t1.txt": "T1\n", "s2/src/t2.txt": "BROKEN\n" })) q.write(p, t);
    q.git(["add", "-A"]); q.git(["commit", "-q", "-m", "base"]);
    expect(await gateCommand(q.root, { deck: "d.json", stubs: "s", refs: "f" }, deps())).toStrictEqual(want("tx"));
    expect(await gateCommand(q.root, { deck: "d.json", stubs: "s2", refs: "f" }, deps())).toStrictEqual(want("planted"));
  } finally { q.rm(); }
}, 120000);

test("Gate Command example 3: refusals, missing files, the chain limit", async () => {
  const r = p7b();
  const q = tmpRepo();
  try {
    expect(await gateCommand(r.root, { ...B1, deck: "nope.json" }, deps())).toStrictEqual(want("deck not found"));
    expect(await gateCommand(r.root, { ...B1, stubs: "nope" }, deps())).toStrictEqual(want("stubs not found"));
    expect(await gateCommand(r.root, { ...B1, refs: "nope" }, deps())).toStrictEqual(want("refs not found"));
    fs.cpSync(r.path("decks/b1/_stubs"), r.path("st3"), { recursive: true }); fs.rmSync(r.path("st3/supervisor/guard.go"));
    fs.cpSync(r.path("decks/b1/_refs"), r.path("rf3"), { recursive: true }); fs.rmSync(r.path("rf3/daemon/daemon.go"));
    expect(await gateCommand(r.root, { ...B1, stubs: "st3", refs: "rf3" }, deps())).toStrictEqual(want("missing"));
    q.write("d.json", JSON.stringify([{ customId: "x", intent: "generate", targets: ["src/x.txt"], contextSlice: [], instruction: "w",
      acceptance: "echo '== probe'\ngrep -q X1 src/x.txt", model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: [] }]));
    q.write("s/src/x.txt", "s\n"); q.write("f/src/x.txt", "X1\n"); q.git(["add", "-A"]); q.git(["commit", "-q", "-m", "base"]);
    expect(await gateCommand(q.root, { deck: "d.json", stubs: "s", refs: "f" }, deps(300000))).toStrictEqual(want("slow"));
  } finally { r.rm(); q.rm(); }
}, 120000);

test("rows: the limit is 250; a deck-side _stubs directory is put back; a chain under the limit and a red ref", async () => {
  expect(CHAIN_LIMIT_SECONDS).toBe(250);
  const q = tmpRepo();
  try {
    q.write("k/d.json", JSON.stringify([{ customId: "x", intent: "generate", targets: ["src/x.txt"], contextSlice: [], instruction: "w",
      acceptance: "echo '== probe'\ngrep -q X1 src/x.txt && [ \"$(cat k/_stubs/keep.txt)\" = kept ] || { echo 'src/x.txt:3: no X1'; echo 'lib/y.py:9: old'; exit 1; }",
      model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: [] }]));
    q.write("k/_stubs/keep.txt", "kept\n"); q.write("s/src/x.txt", "s\n"); q.write("f/src/x.txt", "X2\n");
    q.git(["add", "-A"]); q.git(["commit", "-q", "-m", "base"]);
    const got = await gateCommand(q.root, { deck: "k/d.json", stubs: "s", refs: "f" }, deps(249000));
    const doc = got.document as { errors: string[]; maxSeconds: number; builds: { note: string | null }[] };
    expect([got.code, doc.maxSeconds, doc.builds.length]).toStrictEqual([2, 249, 1]);
    expect(doc.errors).toStrictEqual(["ref x: red (exit 1) at probe: lib/y.py:9: old"]);
    expect(q.read("k/_stubs/keep.txt")).toBe("kept\n");
    const fake = { card: "x", generation: 0, language: "typescript", stubbed: 1, missing: ["m.ts"], breaks: ["src/q.ts(1,1): error TS1: q"], note: null };
    const two = await gateCommand(q.root, { deck: "k/d.json", stubs: "s", refs: "f" }, { ...deps(1000), builds: () => [fake] });
    expect((two.document as { errors: string[] }).errors.slice(0, 2)).toStrictEqual(["build x: no stub for m.ts", "build x: src/q.ts(1,1): error TS1: q"]);
  } finally { q.rm(); }
}, 120000);
