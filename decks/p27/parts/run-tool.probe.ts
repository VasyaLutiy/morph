// P27 probe for run-tool by docs/TASK_P27_scout.md §2.2 (src/scout/runTool.ts) — issue #21 items 6, 8:
// one READ capped in characters, LIST with each file's line count. Record Run Tool examples 5 (changed) and 6;
// the READ rows of example 1 green on main by design.
import fs from "node:fs";
import { test, expect } from "vitest";
import { tmpRoot } from "../../tests/helpers.js";
import type { ScoutFs, ScoutTree } from "../../src/scout/cagePath.js";
import { DEFAULT_TOOL_CAPS, runTool } from "../../src/scout/runTool.js";
import type { ToolCaps } from "../../src/scout/runTool.js";

const NODE_FS: ScoutFs = { realpath: (p) => fs.realpathSync(p), readFile: (p) => fs.readFileSync(p, "utf8") };
const C: ToolCaps = { readLines: 2, grepHits: 3, grepLineChars: 12, listEntries: 2, grepSkip: [".morph", "decks"] };
const FILES: Record<string, string> = {
  "src/a.ts": "l1\nl2\nl3\nl4\nl5\n", "src/e.ts": "", "src/bin.dat": "a\0alpha",
  "src/b.ts": 'const alpha = 1;\nconst beta = 2;\nconst gamma = "alphabetagammadelta";\n',
  "README.md": "alpha here\n", "decks/p1/deck.json": "alpha in a deck\n", ".morph/runs/r/report.json": "alpha in a report\n",
  "tests/a.test.ts": "beta\n",
};

function build(): { p: ReturnType<typeof tmpRoot>; tree: ScoutTree } {
  const p = tmpRoot("morph-p27tool-");
  for (const [k, v] of Object.entries(FILES)) p.write("t/" + k, v);
  p.write("t-out/secret.txt", "alpha secret\n");
  fs.symlinkSync(p.path("t-out/secret.txt"), p.path("t/out.txt"));
  fs.symlinkSync("src", p.path("t/dirlink"));
  return { p, tree: { root: p.path("t"), files: [...Object.keys(FILES), "out.txt", "dirlink"] } };
}

test("Run Tool example 1: READ ranges unchanged (green on main)", () => {
  const { p, tree } = build();
  try {
    expect(runTool({ kind: "read", path: "src/a.ts", from: 2, to: 3 }, tree, NODE_FS, DEFAULT_TOOL_CAPS))
      .toStrictEqual({ text: "READ src/a.ts lines 2-3 of 5\n2: l2\n3: l3", read: true, error: null });
  } finally { p.rm(); }
});

test("Run Tool example 5: LIST the tree with line counts, the cap, a directory", () => {
  const { p, tree } = build();
  try {
    const list = (path: string, caps: ToolCaps) => runTool({ kind: "list", path }, tree, NODE_FS, caps);
    expect(list("", C)).toStrictEqual({ text: "LIST .: 7 entries\n.morph/ (1 file)\nREADME.md (1 line)\n… 5 more entries", read: false, error: null });
    expect(list("", DEFAULT_TOOL_CAPS).text).toBe(
      "LIST .: 7 entries\n.morph/ (1 file)\nREADME.md (1 line)\ndecks/ (1 file)\ndirlink\nout.txt\nsrc/ (4 files)\ntests/ (1 file)");
    expect(list("src/", DEFAULT_TOOL_CAPS).text).toBe("LIST src/: 4 entries\na.ts (5 lines)\nb.ts (3 lines)\nbin.dat (binary)\ne.ts (0 lines)");
    expect(list("src/a.ts", DEFAULT_TOOL_CAPS).text).toBe("LIST failed: no such directory in the tree: src/a.ts");
    expect(list("../x", DEFAULT_TOOL_CAPS).text).toBe("LIST failed: path leaves the root: ../x");
  } finally { p.rm(); }
});

test("Run Tool example 6: the character cap of one READ", () => {
  const p = tmpRoot("morph-p27read-");
  try {
    const W = "w".repeat(250);
    p.write("t/w.txt", (W + "\n").repeat(200));
    p.write("t/long.txt", "x".repeat(13000) + "\n");
    const tree: ScoutTree = { root: p.path("t"), files: ["long.txt", "w.txt"] };
    const read = (path: string, from: number | null, to: number | null, caps: ToolCaps) =>
      runTool({ kind: "read", path, from, to }, tree, NODE_FS, caps);
    const lines = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => `${a + i}: ${W}`).join("\n");
    expect(DEFAULT_TOOL_CAPS.readChars).toBe(12000);
    const one = read("w.txt", null, null, DEFAULT_TOOL_CAPS);
    expect(one).toStrictEqual({ text: "READ w.txt lines 1-47 of 200\n" + lines(1, 47) + "\n… 153 more lines; READ w.txt 48-200 for the next", read: true, error: null });
    expect(one.text.length).toBe(12053);
    const two = read("w.txt", 47, 200, DEFAULT_TOOL_CAPS);
    expect(two.text).toBe("READ w.txt lines 47-93 of 200\n" + lines(47, 93) + "\n… 107 more lines; READ w.txt 94-200 for the next");
    expect(two.text.length).toBe(12063);
    const long = read("long.txt", null, null, DEFAULT_TOOL_CAPS);
    expect(long.text).toBe("READ long.txt lines 1-1 of 1\n1: " + "x".repeat(11997) + "… (+1003 chars)");
    expect(long.text.length).toBe(12044);
    const uncapped: ToolCaps = { readLines: 400, grepHits: 200, grepLineChars: 300, listEntries: 300, grepSkip: [".morph", "decks"] };
    expect(read("w.txt", null, null, uncapped).text).toBe("READ w.txt lines 1-200 of 200\n" + lines(1, 200));
  } finally { p.rm(); }
});
