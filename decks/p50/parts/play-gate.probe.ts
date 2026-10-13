// P50 probe for play-gate (src/gate/playGate.ts) — issue #50 F1: a build error naming a probe file is a named
// probe break, never an outside line. Record gate/Play Gate examples 1-4 (tests/fixtures/gate/playGate.json).
import { expect, test } from "vitest";
import { gatePlan } from "../../src/gate/gatePlan.js";
import { playGate } from "../../src/gate/playGate.js";
import { fixtureJson, tmpRepo } from "../../tests/helpers.js";
import type { Card } from "../../src/cards/types.js";
import type { PlayRow } from "../../src/gate/playGate.js";
import type { TmpRepo } from "../../tests/helpers.js";

const env = (): Record<string, string> => ({ PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" });
const clock = (step: number): (() => number) => { let t = 0; return () => (t += step); };
const rows = (k: string): PlayRow[] => (fixtureJson("gate/playGate.json") as Record<string, PlayRow[]>)[k];
const card = (id: string, targets: string[], acceptance: string | null, dependsOn: string[] = []): Card => ({
  customId: id, intent: "generate", targets, contextSlice: [], instruction: "w", acceptance,
  model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn,
});
function repo(files: Record<string, string>): TmpRepo {
  const r = tmpRepo();
  for (const [p, t] of Object.entries(files)) r.write(p, t);
  r.git(["add", "-A"]);
  r.git(["commit", "-q", "-m", "base"]);
  return r;
}
const play = (r: TmpRepo, cards: Card[], generations: string[][], stubs: string[], refs: string[], step: number, timeoutMs?: number) =>
  playGate(
    { root: r.root, cards, steps: gatePlan(cards, generations, stubs, refs).steps, stubDir: r.path("st"), refDir: r.path("rf") },
    { env: env(), now: clock(step), ...(timeoutMs === undefined ? {} : { timeoutMs }) },
  );
const T123 = ["src/a.txt", "src/b.txt", "tests/c.txt"];

test("Play Gate example 1: a shell plan plays every stub, reference and retry, every row probeBreaks []", async () => {
  const r = repo({
    "d.json": "[]\n", "src/a.txt": "old a\n",
    "st/src/a.txt": "s\n", "st/src/b.txt": "s\n", "st/tests/c.txt": "s\n",
    "rf/src/a.txt": "A1\n", "rf/src/b.txt": "B2\n", "rf/tests/c.txt": "C3\n",
  });
  try {
    const a = "echo '== probe'; grep -q A1 src/a.txt || { echo 'FAIL probe/a.probe.ts > A example 1'; exit 1; }; echo '== frozen'";
    const b = "echo '== tsc'; grep -q B2 src/b.txt || { echo 'src/zz.ts(1,1): error TS2: zz'; exit 2; }\necho '== probe'";
    const c = "echo '== guard tests/c.txt'; grep -q C3 tests/c.txt || exit 1\necho '== own git'; [ \"$(git log -3 --format=%s | tr '\\n' ,)\" = 'gate: b,gate: a,base,' ]";
    const cards: Card[] = [card("a", ["src/a.txt"], a), card("b", ["src/b.txt"], b), card("c", ["tests/c.txt"], c, ["a", "b"])];
    expect(await play(r, cards, [["a", "b"], ["c"]], T123, T123, 1000)).toStrictEqual(rows("shell"));
  } finally {
    r.rm();
  }
}, 120000);

test("Play Gate example 2: the clone links node_modules and excludes it", async () => {
  const r = repo({
    ".gitignore": "node_modules/\n", "d.json": "[]\n",
    "st/src/n.txt": "s\n", "rf/src/n.txt": "N1\n", "node_modules/q/index.js": "q\n",
  });
  try {
    const n = "echo '== probe'; test -L node_modules && test -f node_modules/q/index.js && grep -q N1 src/n.txt && [ -z \"$(git ls-files --others --exclude-standard | grep -vx src/n.txt)\" ]";
    const cards: Card[] = [card("n", ["src/n.txt"], n)];
    expect(await play(r, cards, [["n"]], ["src/n.txt"], ["src/n.txt"], 2500)).toStrictEqual(rows("node_modules"));
  } finally {
    r.rm();
  }
});

test("Play Gate example 3: the 700 ms timeout reaches Run Acceptance", async () => {
  const r = repo({ "d.json": "[]\n", "st/z.txt": "s\n", "st/s.txt": "s\n", "rf/z.txt": "Z1\n", "rf/s.txt": "S1\n" });
  try {
    const cards: Card[] = [
      card("z", ["z.txt"], null),
      card("s", ["s.txt"], "echo '== probe'; echo started; sleep 5; echo late"),
    ];
    expect(await play(r, cards, [["z"], ["s"]], ["z.txt", "s.txt"], ["z.txt", "s.txt"], 100, 700)).toStrictEqual(rows("timeout"));
  } finally {
    r.rm();
  }
});

test("Play Gate example 4: a probe build error is a probe break, never an outside line", async () => {
  const r = repo({ "d.json": "[]\n", "st/src/p.txt": "s\n", "rf/src/p.txt": "P1\n" });
  try {
    const acc = "echo '== probe'\ngrep -q P1 src/p.txt || { echo \"probe/p/p.probe.ts(2,10): error TS2304: Cannot find name 'adaH'.\"; exit 1; }";
    const cards: Card[] = [card("p", ["src/p.txt"], acc)];
    expect(await play(r, cards, [["p"]], ["src/p.txt"], ["src/p.txt"], 1000)).toStrictEqual(rows("probe"));
  } finally {
    r.rm();
  }
});