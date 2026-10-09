// P21b probe for check-builds by docs/TASK_P21b_deckcheck.md §2.2 (src/cli/checkBuilds.ts) — every Go card's stub tree
// of a deck vetted (issue #12 item 3.5) on tests/fixtures/go-p7b: the deck cut before P21a names
// supervisor/guard.go:20, the P21a cut is clean. Record Check Builds examples 1-3.
import fs from "node:fs";
import { test, expect } from "vitest";
import { checkBuilds } from "../../src/cli/checkBuilds.js";
import type { BuildCheck } from "../../src/cli/checkBuilds.js";
import { readDeckFile } from "../../src/cli/document.js";
import { layerGenerations } from "../../src/cards/layer.js";
import type { Deck } from "../../src/cards/types.js";
import { fixture, fixtureJson, fixturePath, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

function copyOf(name: string): TmpRoot { const r = tmpRoot(); fs.cpSync(fixturePath(name), r.root, { recursive: true }); return r; }
const pathEnv = (): Record<string, string> => ({ PATH: process.env.PATH ?? "" });
function goScript(r: TmpRoot, lines: string[]): Record<string, string> {
  r.write("bin/go", "#!/bin/sh\n" + lines.map((l) => 'echo "' + l + '"\n').join("") + "exit 1\n"); fs.chmodSync(r.path("bin/go"), 0o755);
  return { PATH: r.path("bin") + ":" + (process.env.PATH ?? "") };
}
function load(r: TmpRoot, deckPath: string): { deck: Deck; generations: string[][] } {
  const l = readDeckFile(r.root, deckPath); if (!l.ok) throw new Error(deckPath); return { deck: l.deck, generations: layerGenerations(l.deck) };
}
const builds = (k: string): BuildCheck[] => (fixtureJson("cli/checkBuilds.json") as Record<string, BuildCheck[]>)[k];
const run = (r: TmpRoot, d: string, env: Record<string, string>): BuildCheck[] | null => { const l = load(r, d); return checkBuilds(r.root, d, l.deck, l.generations, env); };

test("Check Builds example 1: the old cut names supervisor/guard.go:20, the P21a cut is clean", () => {
  const r = copyOf("go-p7b");
  try {
    expect(run(r, "decks/b1/deck.p20.json", pathEnv())).toStrictEqual(builds("p20"));
    expect(run(r, "decks/b1/deck.p21.json", pathEnv())).toStrictEqual(builds("p21"));
  } finally { r.rm(); }
}, 120000);

test("Check Builds example 2: a missing stub is named, and the old file it leaves breaks later cards", () => {
  const r = copyOf("go-p7b");
  try {
    fs.rmSync(r.path("decks/b1/_stubs/supervisor/guard.go"));
    expect(run(r, "decks/b1/deck.p21.json", pathEnv())).toStrictEqual(builds("p21 without the guard.go stub"));
  } finally { r.rm(); }
}, 120000);

test("Check Builds example 3: no _stubs is null, a TypeScript deck is [], env reaches go", () => {
  const t = tmpRoot();
  const r = copyOf("go-p7b");
  try {
    t.write("d.json", fixture("decks/tiny.json"));
    t.write("src/a.ts", "export const a = 1;\n");
    expect(run(t, "d.json", pathEnv())).toBe(null);
    t.write("_stubs/src/a.ts", "x");
    expect(run(t, "d.json", pathEnv())).toStrictEqual([]);
    const env = goScript(r, ["vet: ./x/fake.go:3:1: fake go ran with $GOFLAGS"]);
    const got = run(r, "decks/b1/deck.p21.json", env) ?? [];
    expect([got.length, got.every((b) => JSON.stringify(b.breaks) === '["x/fake.go:3:1: fake go ran with -mod=mod"]')]).toStrictEqual([8, true]);
    expect(got.map((b) => [b.card, b.generation, b.hidden, b.stubbed])).toStrictEqual(builds("p21").map((b) => [b.card, b.generation, b.hidden, b.stubbed]));
  } finally { t.rm(); r.rm(); }
}, 120000);
