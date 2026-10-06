// P7 probe for deck-check: deckCheckCommand by docs/TASK_P7_cli.md §2.2, one test per record example
// (Component cli, Function Deck Check 1-3), then the §2.2 rows (hazard order, the deck path as given,
// deck-file errors passed through) and the types.
import { test, expect, expectTypeOf } from "vitest";
import { deckCheckCommand } from "../../src/cli/deckCheck.js";
import type { CommandResult, DeckCheckDocument } from "../../src/cli/types.js";
import { fixture, tmpRoot } from "../../tests/helpers.js";

test("Deck Check example 1: a write-write hazard is exit 2", () => {
  const r = tmpRoot();
  try {
    r.write("d.json", fixture("decks/hazardsWriteWrite.json"));
    expect(deckCheckCommand(r.root, "d.json", 500000)).toStrictEqual({ code: 2, document: {
      deck: "d.json", cards: 2, generations: [["a", "b"]], errors: 1, warnings: 0,
      hazards: [{ kind: "write-write", severity: "error", cards: ["a", "b"], path: "src/x.ts", repair: null }],
      weights: [{ card: "a", bytes: 0, missing: ["docs/a.md", "src/x.ts"] }, { card: "b", bytes: 0, missing: ["docs/b.md", "src/x.ts"] }],
    } });
  } finally {
    r.rm();
  }
});

test("Deck Check example 2: warnings only is exit 0", () => {
  const r = tmpRoot();
  try {
    r.write("d.json", fixture("decks/tiny.json"));
    r.write("src/a.ts", "export const a = 1;\n");
    expect(deckCheckCommand(r.root, "d.json", 500000)).toStrictEqual({ code: 0, document: {
      deck: "d.json", cards: 1, generations: [["a"]], errors: 0, warnings: 1,
      hazards: [{ kind: "implicit-read", severity: "warning", cards: ["a"], path: null, repair: null }],
      weights: [{ card: "a", bytes: 20, missing: [] }],
    } });
  } finally {
    r.rm();
  }
});

test("Deck Check example 3: the slice cap adds an oversized-slice warning after the deck's hazards", () => {
  const r = tmpRoot();
  try {
    r.write("d.json", fixture("decks/tiny.json"));
    r.write("src/a.ts", "export const a = 1;\n");
    expect(deckCheckCommand(r.root, "d.json", 10)).toStrictEqual({ code: 0, document: {
      deck: "d.json", cards: 1, generations: [["a"]], errors: 0, warnings: 2,
      hazards: [{ kind: "implicit-read", severity: "warning", cards: ["a"], path: null, repair: null },
        { kind: "oversized-slice", severity: "warning", cards: ["a"], path: null, repair: null, bytes: 20, cap: 10 }],
      weights: [{ card: "a", bytes: 20, missing: [] }],
    } });
  } finally {
    r.rm();
  }
});

test("§2.2: every hazard kind counted; generations from layerGenerations", () => {
  const r = tmpRoot();
  try {
    r.write("decks/all.json", fixture("decks/hazardsAllKinds.json"));
    const got = deckCheckCommand(r.root, "decks/all.json", 500000);
    const doc = got.document as DeckCheckDocument;
    expect(`${got.code} ${doc.deck} ${doc.cards} ${doc.errors} ${doc.warnings}`).toBe("2 decks/all.json 5 3 2");
    expect(doc.hazards.map((h) => h.kind).join(",")).toBe("write-write,read-write,read-write,unordered-read,implicit-read");
    expect(JSON.stringify(doc.generations)).toBe('[["a","b","c","d"],["e"]]');
    expect(Object.keys(doc).join(",")).toBe("deck,cards,generations,errors,warnings,hazards,weights");
  } finally {
    r.rm();
  }
});

test("§2.2: deck-file faults pass through unchanged", () => {
  const r = tmpRoot();
  try {
    r.write("c.json", fixture("decks/cycle.json"));
    expect(deckCheckCommand(r.root, "c.json", 500000)).toStrictEqual({ code: 2, document: { error: { code: 2,
      kind: "DeckError", message: "invalid deck: dependsOn: dependsOn cycle a -> b -> a" } } });
    expect(deckCheckCommand(r.root, "missing.json", 500000)).toStrictEqual({ code: 4, document: { error: { code: 4,
      kind: "UsageError", message: "deck file not found: missing.json" } } });
  } finally {
    r.rm();
  }
});

test("§2.2: the types", () => {
  expectTypeOf(deckCheckCommand).toEqualTypeOf<(root: string, deckPath: string, sliceCapBytes: number) => CommandResult>();
});
