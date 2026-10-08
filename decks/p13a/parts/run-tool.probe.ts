// P13a probe for run-tool by docs/TASK_P13a_scout.md §2.2 (Run Tool) — READ with line ranges and a line cap, GREP over the
// listed files (JavaScript RegExp, hits capped and clipped, .morph/ and decks/ skipped unless named, the cage per file),
// LIST of one directory level; every refusal "<VERB> failed: <error>". Record Run Tool examples 1-5 on one real tmp tree
// (the §2.1 tree), then the §2.2 rows.
import { test, expect } from "vitest";
import fs from "node:fs";
import { tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";
import { DEFAULT_TOOL_CAPS, runTool } from "../../src/scout/runTool.js";
import type { ToolCaps, ToolResult } from "../../src/scout/runTool.js";
import type { ScoutFs, ScoutTree } from "../../src/scout/cagePath.js";

const NODE_FS: ScoutFs = {
  realpath: (p: string): string => fs.realpathSync(p),
  readFile: (p: string): string => fs.readFileSync(p, "utf8"),
};
const C: ToolCaps = { readLines: 2, grepHits: 3, grepLineChars: 12, listEntries: 2, grepSkip: [".morph", "decks"] };
const D = DEFAULT_TOOL_CAPS;

// the §2.1 tree: 10 listed paths under p/t, a secret in the sibling p/t-out, two symlinks
function build(): { p: TmpRoot; tree: ScoutTree } {
  const p = tmpRoot("morph-tool-");
  const files: Record<string, string> = {
    "src/a.ts": "l1\nl2\nl3\nl4\nl5\n",
    "src/e.ts": "",
    "src/bin.dat": "a\0alpha",
    "src/b.ts": "const alpha = 1;\nconst beta = 2;\nconst gamma = \"alphabetagammadelta\";\n",
    "README.md": "alpha here\n",
    "decks/p1/deck.json": "alpha in a deck\n",
    ".morph/runs/r/report.json": "alpha in a report\n",
    "tests/a.test.ts": "beta\n",
  };
  for (const [k, v] of Object.entries(files)) p.write("t/" + k, v);
  p.write("t-out/secret.txt", "alpha secret\n");
  fs.symlinkSync(p.path("t-out/secret.txt"), p.path("t/out.txt"));
  fs.symlinkSync("src", p.path("t/dirlink"));
  const listed = [...Object.keys(files), "out.txt", "dirlink"];
  return { p, tree: { root: p.path("t"), files: listed } };
}
function withTree(fn: (tree: ScoutTree) => void): void {
  const { p, tree } = build();
  try { fn(tree); } finally { p.rm(); }
}
const okText = (text: string, read: boolean): ToolResult => ({ text, read, error: null });
const failed = (verb: string, error: string, read: boolean): ToolResult => ({ text: `${verb} failed: ${error}`, read, error });

test("Run Tool example 1: READ whole, a range, the line cap with its next range, a range past the last line", () => {
  withTree((tree) => {
    expect(runTool({ kind: "read", path: "src/a.ts", from: null, to: null }, tree, NODE_FS, D))
      .toStrictEqual(okText("READ src/a.ts lines 1-5 of 5\n1: l1\n2: l2\n3: l3\n4: l4\n5: l5", true));
    expect(runTool({ kind: "read", path: "src/a.ts", from: 2, to: 3 }, tree, NODE_FS, D))
      .toStrictEqual(okText("READ src/a.ts lines 2-3 of 5\n2: l2\n3: l3", true));
    expect(runTool({ kind: "read", path: "src/a.ts", from: null, to: null }, tree, NODE_FS, C))
      .toStrictEqual(okText("READ src/a.ts lines 1-2 of 5\n1: l1\n2: l2\n… 3 more lines; READ src/a.ts 3-5 for the next", true));
    expect(runTool({ kind: "read", path: "./src/a.ts", from: 4, to: 9 }, tree, NODE_FS, D))
      .toStrictEqual(okText("READ src/a.ts lines 4-5 of 5\n4: l4\n5: l5", true));
  });
});

test("Run Tool example 2: READ refusals and an empty file; a READ counts as a read even when refused", () => {
  withTree((tree) => {
    expect(runTool({ kind: "read", path: "src/a.ts", from: 6, to: 7 }, tree, NODE_FS, D))
      .toStrictEqual(failed("READ", "line range 6-7 is past the end (5 lines): src/a.ts", true));
    expect(runTool({ kind: "read", path: "src/e.ts", from: null, to: null }, tree, NODE_FS, D)).toStrictEqual(okText("READ src/e.ts: empty file", true));
    expect(runTool({ kind: "read", path: "src/bin.dat", from: null, to: null }, tree, NODE_FS, D)).toStrictEqual(failed("READ", "binary file: src/bin.dat", true));
    expect(runTool({ kind: "read", path: "out.txt", from: null, to: null }, tree, NODE_FS, D)).toStrictEqual(failed("READ", "symlink out of the root refused: out.txt", true));
    expect(runTool({ kind: "read", path: "dirlink", from: null, to: null }, tree, NODE_FS, D)).toStrictEqual(failed("READ", "unreadable: dirlink", true));
    expect(runTool({ kind: "read", path: "src/zz.ts", from: null, to: null }, tree, NODE_FS, D))
      .toStrictEqual(failed("READ", "not in the tree (missing, ignored or a directory): src/zz.ts", true));
  });
});

test("Run Tool example 3: GREP over the tree with the small caps — hits capped and clipped, Morph's own directories skipped, the cage per file", () => {
  withTree((tree) => {
    expect(runTool({ kind: "grep", pattern: "alpha|beta", path: "" }, tree, NODE_FS, C)).toStrictEqual(okText([
      "GREP /alpha|beta/ in the tree: 5 matches in 3 files",
      "README.md:1: alpha here",
      "src/b.ts:1: const alpha … (+4 chars)",
      "src/b.ts:2: const beta =… (+3 chars)",
      "… 2 more matches",
      "(2 files refused by the cage)",
    ].join("\n"), false));
  });
});

test("Run Tool example 4: GREP in a named skipped directory, with no skip list, no match, an unknown directory, a bad pattern", () => {
  withTree((tree) => {
    expect(runTool({ kind: "grep", pattern: "alpha", path: "decks" }, tree, NODE_FS, D))
      .toStrictEqual(okText("GREP /alpha/ in decks/: 1 match in 1 file\ndecks/p1/deck.json:1: alpha in a deck", false));
    expect(runTool({ kind: "grep", pattern: "alpha", path: "" }, tree, NODE_FS, { ...D, grepSkip: [] })).toStrictEqual(okText([
      "GREP /alpha/ in the tree: 5 matches in 4 files",
      ".morph/runs/r/report.json:1: alpha in a report",
      "README.md:1: alpha here",
      "decks/p1/deck.json:1: alpha in a deck",
      "src/b.ts:1: const alpha = 1;",
      "src/b.ts:3: const gamma = \"alphabetagammadelta\";",
      "(2 files refused by the cage)",
    ].join("\n"), false));
    expect(runTool({ kind: "grep", pattern: "zzz", path: "src" }, tree, NODE_FS, D)).toStrictEqual(okText("GREP /zzz/ in src/: 0 matches in 0 files", false));
    expect(runTool({ kind: "grep", pattern: "x", path: "nope" }, tree, NODE_FS, D)).toStrictEqual(failed("GREP", "no such directory in the tree: nope", false));
    expect(runTool({ kind: "grep", pattern: "(", path: "" }, tree, NODE_FS, D)).toStrictEqual(failed("GREP", "invalid pattern /(/", false));
  });
});

test("Run Tool example 5: LIST of the root (capped, then whole), of a directory, refusals", () => {
  withTree((tree) => {
    expect(runTool({ kind: "list", path: "" }, tree, NODE_FS, C))
      .toStrictEqual(okText("LIST .: 7 entries\n.morph/ (1 file)\nREADME.md\n… 5 more entries", false));
    expect(runTool({ kind: "list", path: "" }, tree, NODE_FS, D)).toStrictEqual(okText([
      "LIST .: 7 entries", ".morph/ (1 file)", "README.md", "decks/ (1 file)", "dirlink", "out.txt", "src/ (4 files)", "tests/ (1 file)",
    ].join("\n"), false));
    expect(runTool({ kind: "list", path: "src/" }, tree, NODE_FS, D)).toStrictEqual(okText("LIST src/: 4 entries\na.ts\nb.ts\nbin.dat\ne.ts", false));
    expect(runTool({ kind: "list", path: "src/a.ts" }, tree, NODE_FS, D)).toStrictEqual(failed("LIST", "no such directory in the tree: src/a.ts", false));
    expect(runTool({ kind: "list", path: "../x" }, tree, NODE_FS, D)).toStrictEqual(failed("LIST", "path leaves the root: ../x", false));
  });
});

test("§2.2 rows: DEFAULT_TOOL_CAPS; an in-memory tree — CRLF, a file without a final newline, the sorted listing, the skip by first segment", () => {
  expect(DEFAULT_TOOL_CAPS).toStrictEqual({ readLines: 400, grepHits: 200, grepLineChars: 300, listEntries: 300, grepSkip: [".morph", "decks"] });
  const text: Record<string, string> = {
    "/m/z.ts": "one\r\ntwo\r\n",
    "/m/b/x.ts": "k\nk\nk",
    "/m/a/decks/d.ts": "k\n",
    "/m/b/y.ts": "k\n\nk\n",
    "/m/decksx/q.ts": "k\n",
  };
  const mem: ScoutFs = {
    realpath: (p: string): string => p,
    readFile: (p: string): string => { const t = text[p]; if (t === undefined) throw new Error("ENOENT " + p); return t; },
  };
  const tree: ScoutTree = { root: "/m", files: ["z.ts", "b/y.ts", "decksx/q.ts", "b/x.ts", "a/decks/d.ts"] };
  const caps: ToolCaps = { readLines: 1, grepHits: 4, grepLineChars: 1, listEntries: 1, grepSkip: ["decks", "b"] };
  expect(runTool({ kind: "read", path: "z.ts", from: null, to: null }, tree, mem, D)).toStrictEqual(okText("READ z.ts lines 1-2 of 2\n1: one\n2: two", true));
  expect(runTool({ kind: "read", path: "b/x.ts", from: 2, to: 3 }, tree, mem, caps))
    .toStrictEqual(okText("READ b/x.ts lines 2-2 of 3\n2: k\n… 1 more lines; READ b/x.ts 3-3 for the next", true));
  expect(runTool({ kind: "read", path: "b/y.ts", from: 2, to: 2 }, tree, mem, D)).toStrictEqual(okText("READ b/y.ts lines 2-2 of 3\n2: ", true));
  expect(runTool({ kind: "read", path: "b/y.ts", from: 4, to: 4 }, tree, mem, D)).toStrictEqual(failed("READ", "line range 4-4 is past the end (3 lines): b/y.ts", true));
  expect(runTool({ kind: "grep", pattern: "^k$", path: "" }, tree, mem, caps)).toStrictEqual(okText(
    "GREP /^k$/ in the tree: 2 matches in 2 files\na/decks/d.ts:1: k\ndecksx/q.ts:1: k", false));
  expect(runTool({ kind: "grep", pattern: "k", path: "b" }, tree, mem, caps)).toStrictEqual(okText(
    "GREP /k/ in b/: 5 matches in 2 files\nb/x.ts:1: k\nb/x.ts:2: k\nb/x.ts:3: k\nb/y.ts:1: k\n… 1 more matches", false));
  expect(runTool({ kind: "grep", pattern: "^tw", path: "./" }, tree, mem, caps)).toStrictEqual(okText(
    "GREP /^tw/ in the tree: 1 match in 1 file\nz.ts:2: t… (+2 chars)", false));
  expect(runTool({ kind: "list", path: "" }, tree, mem, caps)).toStrictEqual(okText("LIST .: 4 entries\na/ (1 file)\n… 3 more entries", false));
  expect(runTool({ kind: "list", path: "b" }, tree, mem, D)).toStrictEqual(okText("LIST b/: 2 entries\nx.ts\ny.ts", false));
  expect(runTool({ kind: "list", path: "a" }, tree, mem, D)).toStrictEqual(okText("LIST a/: 1 entry\ndecks/ (1 file)", false));
  expect(runTool({ kind: "grep", pattern: "k", path: "z.ts" }, tree, mem, D)).toStrictEqual(failed("GREP", "no such directory in the tree: z.ts", false));
  const gone: ScoutTree = { root: "/m", files: ["z.ts", "lost.ts"] };
  expect(runTool({ kind: "grep", pattern: "ne", path: "" }, gone, mem, D)).toStrictEqual(okText(
    "GREP /ne/ in the tree: 1 match in 1 file\nz.ts:1: one\n(1 file refused by the cage)", false));
  expect(runTool({ kind: "read", path: "lost.ts", from: null, to: null }, gone, mem, D)).toStrictEqual(failed("READ", "unreadable: lost.ts", true));
});
