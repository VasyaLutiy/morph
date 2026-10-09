// P21b probe for deck-check by docs/TASK_P21b_deckcheck.md §2.2 (src/cli/deckCheck.ts, types.ts, main.ts) — `morph deck
// check` builds each Go card's stub tree when the deck has a _stubs/ directory and names file:line outside its targets
// (issue #12 item 3.5, MorphStudio eb52a5a). Record Deck Check examples 4-6, then a row.
import fs from "node:fs";
import { test, expect } from "vitest";
import { deckCheckCommand } from "../../src/cli/deckCheck.js";
import { main } from "../../src/cli/main.js";
import type { BuildCheck } from "../../src/cli/checkBuilds.js";
import type { CliIo, DeckCheckDocument } from "../../src/cli/types.js";
import { fixture, fixtureJson, fixturePath, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

function copyOf(name: string): TmpRoot { const r = tmpRoot(); fs.cpSync(fixturePath(name), r.root, { recursive: true }); return r; }
const pathEnv = (): Record<string, string> => ({ PATH: process.env.PATH ?? "" });
function goScript(r: TmpRoot, lines: string[]): Record<string, string> {
  r.write("bin/go", "#!/bin/sh\n" + lines.map((l) => 'echo "' + l + '"\n').join("") + "exit 1\n"); fs.chmodSync(r.path("bin/go"), 0o755);
  return { PATH: r.path("bin") + ":" + (process.env.PATH ?? "") };
}
const builds = (k: string): BuildCheck[] => (fixtureJson("cli/checkBuilds.json") as Record<string, BuildCheck[]>)[k];
const GENS = [["control-contract"], ["control-contract-judge", "phase-loop"], ["phase-loop-judge", "runtime-guard"], ["daemon-core", "runtime-guard-judge"], ["daemon-core-judge"]];
const DC2: DeckCheckDocument = { deck: "d.json", cards: 1, generations: [["a"]], errors: 0, warnings: 1,
  hazards: [{ kind: "implicit-read", severity: "warning", cards: ["a"], path: null, repair: null }], weights: [{ card: "a", bytes: 20, missing: [] }] };

test("Deck Check example 4: the old cut exits 2 naming supervisor/guard.go:20, the P21a cut exits 0", () => {
  const r = copyOf("go-p7b");
  try {
    const old = deckCheckCommand(r.root, "decks/b1/deck.p20.json", 500000, pathEnv());
    const d = old.document as DeckCheckDocument;
    expect([old.code, d.errors, d.warnings, d.generations, d.builds, Object.keys(d).at(-1)]).toStrictEqual([2, 7, 0, GENS, builds("p20"), "builds"]);
    expect(d.builds?.find((b) => b.card === "phase-loop")?.breaks).toStrictEqual(["supervisor/guard.go:20:23: l.Resumes undefined (type *Loop has no field or method Resumes)"]);
    const neu = deckCheckCommand(r.root, "decks/b1/deck.p21.json", 500000, pathEnv());
    const n = neu.document as DeckCheckDocument;
    expect([neu.code, n.errors, n.builds]).toStrictEqual([0, 0, builds("p21")]);
  } finally { r.rm(); }
}, 120000);

test("Deck Check example 5: a deck with _stubs and no Go card gets builds []; without _stubs no key", () => {
  const r = tmpRoot();
  try {
    r.write("d.json", fixture("decks/tiny.json"));
    r.write("src/a.ts", "export const a = 1;\n");
    expect(deckCheckCommand(r.root, "d.json", 500000)).toStrictEqual({ code: 0, document: DC2 });
    r.write("_stubs/src/a.ts", "x");
    expect(deckCheckCommand(r.root, "d.json", 500000)).toStrictEqual({ code: 0, document: { ...DC2, builds: [] } });
  } finally { r.rm(); }
});

test("Deck Check example 6: main hands deps.env to the check", async () => {
  const r = copyOf("go-p7b");
  try {
    const env = goScript(r, ["vet: ./x/fake.go:3:1: fake go ran with $GOFLAGS"]);
    const out: string[] = [], err: string[] = [];
    const io: CliIo = { stdout: (t) => { out.push(t); }, stderr: (t) => { err.push(t); } };
    const code = await main(["deck", "check", "--deck", "decks/b1/deck.p21.json", "--root", r.root], { env, now: () => 0, cwd: "/", transport: null }, io);
    const d = JSON.parse(out.join("")) as DeckCheckDocument;
    expect([code, err, out.length, d.errors, (d.builds ?? []).map((b) => b.breaks)]).toStrictEqual(
      [2, ["morph deck check: exit 2\n"], 1, 8, Array.from({ length: 8 }, () => ["x/fake.go:3:1: fake go ran with -mod=mod"])]);
  } finally { r.rm(); }
}, 120000);

test("row: a missing stub counts as an error even with no break", () => {
  const r = copyOf("go-p7b");
  try {
    const env = goScript(r, []);
    fs.rmSync(r.path("decks/b1/_stubs/daemon/daemon_examples_test.go"));
    const got = deckCheckCommand(r.root, "decks/b1/deck.p21.json", 500000, env);
    const d = got.document as DeckCheckDocument;
    expect([got.code, d.errors, (d.builds ?? []).map((b) => b.missing.length)]).toStrictEqual([2, 1, [0, 0, 0, 0, 0, 0, 0, 1]]);
  } finally { r.rm(); }
}, 120000);
