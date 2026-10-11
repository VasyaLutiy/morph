import { expect, test } from "vitest";
import { readDeckFile } from "../../src/cli/document.js";
import { unprovenStubs } from "../../src/cli/unprovenStubs.js";
import { fixtureJson, tmpRoot } from "../helpers.js";

function writeFixture(root: ReturnType<typeof tmpRoot>): Record<string, string> {
  const files = fixtureJson("cli/unproven.json") as Record<string, string>;
  for (const [p, t] of Object.entries(files)) root.write(p, t);
  return files;
}

function loadDeck(root: string, deckPath: string) {
  const loaded = readDeckFile(root, deckPath);
  if (!loaded.ok) throw new Error("invalid deck fixture: " + deckPath);
  return loaded.deck;
}

test("Unproven Stubs example 1: an equal stub, a missing stub, a differing stub, and a transaction deck without _stubs/", () => {
  const r = tmpRoot();
  try {
    writeFixture(r);

    const q = loadDeck(r.root, "decks/q/deck.json");
    expect(unprovenStubs(r.root, "decks/q/deck.json", q)).toStrictEqual([
      {
        card: "a",
        path: "calc/a.go",
        reason:
          "the stub equals the committed file: the build proved nothing about its names",
      },
      {
        card: "b",
        path: "src/c.ts",
        reason: "no stub: the build used the committed file",
      },
    ]);

    const t = loadDeck(r.root, "decks/t/deck.json");
    expect(unprovenStubs(r.root, "decks/t/deck.json", t)).toStrictEqual([
      {
        card: "a",
        path: "calc/a.go",
        reason: "no _stubs/ beside the deck: no build ran",
      },
      {
        card: "b",
        path: "src/b.ts",
        reason: "no _stubs/ beside the deck: no build ran",
      },
      {
        card: "b",
        path: "src/c.ts",
        reason: "no _stubs/ beside the deck: no build ran",
      },
    ]);

    const u = loadDeck(r.root, "decks/u/deck.json");
    expect(unprovenStubs(r.root, "decks/u/deck.json", u)).toStrictEqual([]);
  } finally {
    r.rm();
  }
});

test("Unproven Stubs: a transaction deck whose _stubs/ holds a differing stub for one on-disk target", () => {
  const r = tmpRoot();
  try {
    const files = writeFixture(r);
    r.write("decks/t/_stubs/calc/a.go", files["calc/a.go"] + "\n// drift\n");
    const t = loadDeck(r.root, "decks/t/deck.json");
    expect(unprovenStubs(r.root, "decks/t/deck.json", t)).toStrictEqual([
      {
        card: "b",
        path: "src/b.ts",
        reason: "no stub: the build used the committed file",
      },
      {
        card: "b",
        path: "src/c.ts",
        reason: "no stub: the build used the committed file",
      },
    ]);
  } finally {
    r.rm();
  }
});

test("Unproven Stubs: a plain deck with a _stubs/ whose equal, differing and missing stubs split the list", () => {
  const r = tmpRoot();
  try {
    const files = writeFixture(r);
    r.write("decks/u/_stubs/calc/a.go", files["calc/a.go"]);
    r.write("decks/u/_stubs/src/b.ts", files["src/b.ts"] + "\n// drift\n");
    const u = loadDeck(r.root, "decks/u/deck.json");
    expect(unprovenStubs(r.root, "decks/u/deck.json", u)).toStrictEqual([
      {
        card: "a",
        path: "calc/a.go",
        reason:
          "the stub equals the committed file: the build proved nothing about its names",
      },
      {
        card: "b",
        path: "src/c.ts",
        reason: "no stub: the build used the committed file",
      },
    ]);
  } finally {
    r.rm();
  }
});

test("Unproven Stubs: every on-disk target whose stub equals the committed file is named", () => {
  const r = tmpRoot();
  try {
    const files = writeFixture(r);
    r.write("decks/u/_stubs/calc/a.go", files["calc/a.go"]);
    r.write("decks/u/_stubs/src/b.ts", files["src/b.ts"]);
    r.write("decks/u/_stubs/src/c.ts", files["src/c.ts"]);
    const u = loadDeck(r.root, "decks/u/deck.json");
    expect(unprovenStubs(r.root, "decks/u/deck.json", u)).toStrictEqual([
      {
        card: "a",
        path: "calc/a.go",
        reason:
          "the stub equals the committed file: the build proved nothing about its names",
      },
      {
        card: "b",
        path: "src/b.ts",
        reason:
          "the stub equals the committed file: the build proved nothing about its names",
      },
      {
        card: "b",
        path: "src/c.ts",
        reason:
          "the stub equals the committed file: the build proved nothing about its names",
      },
    ]);
  } finally {
    r.rm();
  }
});
