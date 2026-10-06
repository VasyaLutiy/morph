import { expect, test } from "vitest";
import { deckCheckCommand } from "../../src/cli/deckCheck.js";
import type { CommandResult, DeckCheckDocument, ErrorDocument } from "../../src/cli/types.js";
import { fixture, tmpRoot } from "../helpers.js";
import type { TmpRoot } from "../helpers.js";

function deckRoot(deckFixture: string, files: Record<string, string> = {}): TmpRoot {
  const r = tmpRoot();
  r.write("d.json", fixture(deckFixture));
  for (const [rel, text] of Object.entries(files)) {
    r.write(rel, text);
  }
  return r;
}

test("Deck Check example 1: write-write on the same target is one hazard error and exit 2", () => {
  const r = deckRoot("decks/hazardsWriteWrite.json");
  try {
    const got: CommandResult = deckCheckCommand(r.root, "d.json", 500000);
    expect(got.code).toBe(2);
    const doc = got.document as DeckCheckDocument;
    expect(doc).toStrictEqual({
      deck: "d.json",
      cards: 2,
      generations: [["a", "b"]],
      errors: 1,
      warnings: 0,
      hazards: [
        { kind: "write-write", severity: "error", cards: ["a", "b"], path: "src/x.ts", repair: null },
      ],
      weights: [
        { card: "a", bytes: 0, missing: ["docs/a.md", "src/x.ts"] },
        { card: "b", bytes: 0, missing: ["docs/b.md", "src/x.ts"] },
      ],
    });
  } finally {
    r.rm();
  }
});

test("Deck Check example 2: a tiny deck over a 20-byte file is one implicit-read warning and exit 0", () => {
  const r = deckRoot("decks/tiny.json", { "src/a.ts": "export const a = 1;\n" });
  try {
    const got: CommandResult = deckCheckCommand(r.root, "d.json", 500000);
    expect(got.code).toBe(0);
    const doc = got.document as DeckCheckDocument;
    expect(doc).toStrictEqual({
      deck: "d.json",
      cards: 1,
      generations: [["a"]],
      errors: 0,
      warnings: 1,
      hazards: [
        { kind: "implicit-read", severity: "warning", cards: ["a"], path: null, repair: null },
      ],
      weights: [{ card: "a", bytes: 20, missing: [] }],
    });
  } finally {
    r.rm();
  }
});

test("Deck Check example 3: a 10-byte cap adds an oversized-slice warning after the implicit-read", () => {
  const r = deckRoot("decks/tiny.json", { "src/a.ts": "export const a = 1;\n" });
  try {
    const got: CommandResult = deckCheckCommand(r.root, "d.json", 10);
    expect(got.code).toBe(0);
    const doc = got.document as DeckCheckDocument;
    expect(doc).toStrictEqual({
      deck: "d.json",
      cards: 1,
      generations: [["a"]],
      errors: 0,
      warnings: 2,
      hazards: [
        { kind: "implicit-read", severity: "warning", cards: ["a"], path: null, repair: null },
        {
          kind: "oversized-slice",
          severity: "warning",
          cards: ["a"],
          path: null,
          repair: null,
          bytes: 20,
          cap: 10,
        },
      ],
      weights: [{ card: "a", bytes: 20, missing: [] }],
    });
  } finally {
    r.rm();
  }
});

test("Deck Check own 1: a missing deck file is a UsageError with the path as given", () => {
  const r = tmpRoot();
  try {
    const got: CommandResult = deckCheckCommand(r.root, "nope.json", 500000);
    expect(got.code).toBe(4);
    const doc = got.document as ErrorDocument;
    expect(doc.error.kind).toBe("UsageError");
    expect(doc.error.message).toBe("deck file not found: nope.json");
  } finally {
    r.rm();
  }
});

test("Deck Check own 2: a directory in place of the deck file is not found", () => {
  const r = tmpRoot();
  r.write("adir/x.txt", "x");
  try {
    const got: CommandResult = deckCheckCommand(r.root, "adir", 500000);
    expect(got.code).toBe(4);
    const doc = got.document as ErrorDocument;
    expect(doc.error.kind).toBe("UsageError");
    expect(doc.error.message).toBe("deck file not found: adir");
  } finally {
    r.rm();
  }
});

test("Deck Check own 3: a dependsOn cycle is a DeckError with the fault text", () => {
  const r = deckRoot("decks/cycle.json");
  try {
    const got: CommandResult = deckCheckCommand(r.root, "d.json", 500000);
    expect(got.code).toBe(2);
    const doc = got.document as ErrorDocument;
    expect(doc.error.kind).toBe("DeckError");
    expect(doc.error.message).toBe("invalid deck: dependsOn: dependsOn cycle a -> b -> a");
  } finally {
    r.rm();
  }
});

test("Deck Check own 4: a duplicate customId is a DeckError naming the fault key", () => {
  const r = deckRoot("decks/duplicate.json");
  try {
    const got: CommandResult = deckCheckCommand(r.root, "d.json", 500000);
    expect(got.code).toBe(2);
    const doc = got.document as ErrorDocument;
    expect(doc.error.kind).toBe("DeckError");
    expect(doc.error.message).toBe("invalid deck: cards[2].customId: duplicate customId b");
  } finally {
    r.rm();
  }
});
