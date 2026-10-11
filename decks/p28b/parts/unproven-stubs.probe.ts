// P28b probe for unproven-stubs by docs/TASK_P28b_unproven.md §2.2 (src/cli/unprovenStubs.ts, NEW) — issue #22 M3:
// the targets whose committed file the deck check's build could not tell apart from its stub. Record Unproven Stubs
// example 1 (three calls on one root).
import { test, expect } from "vitest";
import { unprovenStubs } from "../../src/cli/unprovenStubs.js";
import { readDeckFile } from "../../src/cli/document.js";
import { fixtureJson, tmpRoot } from "../../tests/helpers.js";

const SAME = "the stub equals the committed file: the build proved nothing about its names";
const MISS = "no stub: the build used the committed file";
const NONE = "no _stubs/ beside the deck: no build ran";

test("Unproven Stubs example 1: a stub equal to the tree or missing is listed; a transaction deck without _stubs/ lists every committed target; a plain one nothing", () => {
  const r = tmpRoot("morph-unproven-");
  try {
    for (const [p, t] of Object.entries(fixtureJson("cli/unproven.json") as Record<string, string>)) r.write(p, t);
    const got: Record<string, unknown> = {};
    for (const d of ["q", "t", "u"]) {
      const deckPath = "decks/" + d + "/deck.json";
      const loaded = readDeckFile(r.root, deckPath);
      if (!loaded.ok) throw new Error("deck not read: " + deckPath);
      got[d] = unprovenStubs(r.root, deckPath, loaded.deck);
    }
    expect(got).toStrictEqual({
      q: [{ card: "a", path: "calc/a.go", reason: SAME }, { card: "b", path: "src/c.ts", reason: MISS }],
      t: [{ card: "a", path: "calc/a.go", reason: NONE }, { card: "b", path: "src/b.ts", reason: NONE }, { card: "b", path: "src/c.ts", reason: NONE }],
      u: [],
    });
    expect(r.read("decks/q/_stubs/calc/a.go")).toBe("package calc\n");
  } finally {
    r.rm();
  }
});
