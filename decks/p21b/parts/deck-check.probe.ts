// P21b probe for deck-check by docs/TASK_P21b_deckcheck.md §2.2 (src/cli/deckCheck.ts, types.ts, main.ts) — `morph deck
// check` compiles each card's stub tree when the deck has a _stubs/ directory and names file:line outside its targets,
// per language (issue #12 item 3.5, MorphStudio eb52a5a, comment 6077766447). Record Deck Check examples 4-6, then a row.
import fs from "node:fs";
import path from "node:path";
import { test, expect } from "vitest";
import { deckCheckCommand } from "../../src/cli/deckCheck.js";
import { main } from "../../src/cli/main.js";
import type { BuildCheck } from "../../src/cli/checkBuilds.js";
import type { CliIo, DeckCheckDocument } from "../../src/cli/types.js";
import { fixture, fixtureJson, fixturePath, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

function copyOf(name: string): TmpRoot { const r = tmpRoot(); fs.cpSync(fixturePath(name), r.root, { recursive: true }); return r; }
function rootOf(name: string): TmpRoot { const r = tmpRoot(); for (const [p, t] of Object.entries(fixtureJson(name) as Record<string, string>)) r.write(p, t);
  fs.symlinkSync(path.resolve(fixturePath("."), "../../node_modules"), r.path("node_modules")); return r; }
const pathEnv = (): Record<string, string> => ({ PATH: process.env.PATH ?? "" });
function scriptsRoot(): { r: TmpRoot; env: Record<string, string> } {
  const r = tmpRoot(); r.write("d.json", fixture("planner/stub.cards.json"));
  for (const f of ["calc/a.go", "report/c.go", "src/t.ts", "tests/t.test.ts"]) r.write("_stubs/" + f, "x\n");
  r.write("bin/go", '#!/bin/sh\necho "vet: ./calc/zz.go:1:2: go ran with $GOFLAGS"\nexit 1\n');
  r.write("node_modules/.bin/tsc", '#!/bin/sh\necho "src/t.ts(1,1): error TS1: own"\necho "src/zz.ts(2,3): error TS2: tsc ran with $NO_COLOR $3"\nexit 2\n');
  fs.chmodSync(r.path("bin/go"), 0o755); fs.chmodSync(r.path("node_modules/.bin/tsc"), 0o755);
  return { r, env: { PATH: r.path("bin") + ":" + (process.env.PATH ?? "") } };
}
const builds = (k: string): BuildCheck[] => (fixtureJson("cli/checkBuilds.json") as Record<string, BuildCheck[]>)[k];
const GENS = [["control-contract"], ["control-contract-judge", "phase-loop"], ["phase-loop-judge", "runtime-guard"], ["daemon-core", "runtime-guard-judge"], ["daemon-core-judge"]];
const DC2: DeckCheckDocument = { deck: "d.json", cards: 1, generations: [["a"]], errors: 0, warnings: 1,
  hazards: [{ kind: "implicit-read", severity: "warning", cards: ["a"], path: null, repair: null }], weights: [{ card: "a", bytes: 20, missing: [] }] };

test("Deck Check example 4: go-p7b's old cut exits 2 naming supervisor/guard.go:20, the P21a cut exits 0", () => {
  const r = copyOf("go-p7b");
  try {
    const old = deckCheckCommand(r.root, "decks/b1/deck.p20.json", 500000, pathEnv());
    const d = old.document as DeckCheckDocument;
    expect([old.code, d.errors, d.warnings, d.generations, d.builds, Object.keys(d).at(-1)]).toStrictEqual([2, 9, 0, GENS, builds("p20"), "builds"]);
    expect(d.builds?.find((b) => b.card === "phase-loop")?.breaks).toStrictEqual(["supervisor/guard.go:20:23: l.Resumes undefined (type *Loop has no field or method Resumes)"]);
    const neu = deckCheckCommand(r.root, "decks/b1/deck.p21.json", 500000, pathEnv());
    const n = neu.document as DeckCheckDocument;
    expect([neu.code, n.errors, n.builds]).toStrictEqual([0, 0, builds("p21")]);
  } finally { r.rm(); }
}, 120000);

test("Deck Check example 5: a TypeScript deck is compiled with tsc; a card with no config is a note, a warning", () => {
  const r = rootOf("ts-rename.json");
  const t = tmpRoot();
  try {
    const got = deckCheckCommand(r.root, "decks/r1/deck.json", 500000, pathEnv());
    const d = got.document as DeckCheckDocument;
    expect([got.code, d.errors, d.warnings, d.builds]).toStrictEqual([2, 5, 0, builds("ts-rename")]);
    t.write("d.json", fixture("decks/tiny.json"));
    t.write("src/a.ts", "export const a = 1;\n");
    expect(deckCheckCommand(t.root, "d.json", 500000)).toStrictEqual({ code: 0, document: DC2 });
    t.write("_stubs/src/a.ts", "x");
    expect(deckCheckCommand(t.root, "d.json", 500000)).toStrictEqual({ code: 0, document: { ...DC2, warnings: 2, builds: [{ card: "a", generation: 0,
      language: "typescript", stubbed: 0, missing: [], breaks: [], note: "the acceptance writes no $P/tsconfig.card.json: not built" }] } });
  } finally { r.rm(); t.rm(); }
}, 120000);

test("Deck Check example 6: main hands deps.env to the check; notes are warnings, missing and breaks errors", async () => {
  const { r, env } = scriptsRoot();
  try {
    const out: string[] = [], err: string[] = [];
    const io: CliIo = { stdout: (t) => { out.push(t); }, stderr: (t) => { err.push(t); } };
    const code = await main(["deck", "check", "--deck", "d.json", "--root", r.root], { env, now: () => 0, cwd: "/", transport: null }, io);
    const d = JSON.parse(out.join("")) as DeckCheckDocument;
    expect([code, err, out.length, d.errors, d.warnings, d.builds]).toStrictEqual([2, ["morph deck check: exit 2\n"], 1, 17, 12, builds("cards")]);
  } finally { r.rm(); }
}, 120000);

test("row: a missing stub alone is an error", () => {
  const r = copyOf("go-p7b");
  try {
    fs.rmSync(r.path("decks/b1/_stubs/daemon/daemon_examples_test.go"));
    const got = deckCheckCommand(r.root, "decks/b1/deck.p21.json", 500000, pathEnv());
    const d = got.document as DeckCheckDocument;
    expect([got.code, d.errors, (d.builds ?? []).map((b) => b.missing.length)]).toStrictEqual([2, 1, [0, 0, 0, 0, 0, 0, 0, 1]]);
  } finally { r.rm(); }
}, 120000);
