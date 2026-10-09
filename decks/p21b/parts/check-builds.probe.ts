// P21b probe for check-builds by docs/TASK_P21b_deckcheck.md §2.2 (src/cli/checkBuilds.ts) — every card's stub tree of a
// deck compiled by its language's step (issue #12 item 3.5, comment 6077766447): go-p7b's old cut names
// supervisor/guard.go:20, its P21a cut is clean; ts-rename names the later card's old file; a language with no step and
// a card with no config are said so. Record Check Builds examples 1-3.
import fs from "node:fs";
import path from "node:path";
import { test, expect } from "vitest";
import { checkBuilds } from "../../src/cli/checkBuilds.js";
import type { BuildCheck } from "../../src/cli/checkBuilds.js";
import { readDeckFile } from "../../src/cli/document.js";
import { layerGenerations } from "../../src/cards/layer.js";
import type { Deck } from "../../src/cards/types.js";
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
function load(r: TmpRoot, deckPath: string): { deck: Deck; generations: string[][] } {
  const l = readDeckFile(r.root, deckPath); if (!l.ok) throw new Error(deckPath); return { deck: l.deck, generations: layerGenerations(l.deck) };
}
const builds = (k: string): BuildCheck[] => (fixtureJson("cli/checkBuilds.json") as Record<string, BuildCheck[]>)[k];
const run = (r: TmpRoot, d: string, env: Record<string, string>): BuildCheck[] | null => { const l = load(r, d); return checkBuilds(r.root, d, l.deck, l.generations, env); };

test("Check Builds example 1: go-p7b's old cut names supervisor/guard.go:20, the P21a cut is clean, a missing stub is named", () => {
  const r = copyOf("go-p7b");
  try {
    expect(run(r, "decks/b1/deck.p20.json", pathEnv())).toStrictEqual(builds("p20"));
    expect(run(r, "decks/b1/deck.p21.json", pathEnv())).toStrictEqual(builds("p21"));
    fs.rmSync(r.path("decks/b1/_stubs/supervisor/guard.go"));
    expect(run(r, "decks/b1/deck.p21.json", pathEnv())).toStrictEqual(builds("p21 without the guard.go stub"));
  } finally { r.rm(); }
}, 120000);

test("Check Builds example 2: a TypeScript rename across modules, tsc on each tree", () => {
  const r = rootOf("ts-rename.json");
  try {
    expect(run(r, "decks/r1/deck.json", pathEnv())).toStrictEqual(builds("ts-rename"));
  } finally { r.rm(); }
}, 120000);

test("Check Builds example 3: notes for no step and no config; env reaches each language's step", () => {
  const { r, env } = scriptsRoot();
  const t = tmpRoot();
  try {
    expect(run(r, "d.json", env)).toStrictEqual(builds("cards"));
    t.write("d.json", fixture("decks/tiny.json"));
    expect(run(t, "d.json", pathEnv())).toBe(null);
  } finally { r.rm(); t.rm(); }
}, 120000);
