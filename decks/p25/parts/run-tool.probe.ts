// P25 probe for run-tool by docs/TASK_P25_config.md §2.2 (src/scout/runTool.ts) — issue #18 item 3:
// grepSkip entries are path prefixes; a GREP that names one lifts it. Record Run Tool example 8; the bare-name
// rows (DEFAULT_TOOL_CAPS) green on main by design.
import fs from "node:fs";
import { test, expect } from "vitest";
import { tmpRoot } from "../../tests/helpers.js";
import type { ScoutFs, ScoutTree } from "../../src/scout/cagePath.js";
import { DEFAULT_TOOL_CAPS, runTool } from "../../src/scout/runTool.js";
import type { ToolCaps } from "../../src/scout/runTool.js";

const NODE_FS: ScoutFs = { realpath: (p) => fs.realpathSync(p), readFile: (p) => fs.readFileSync(p, "utf8") };
const K: ToolCaps = { ...DEFAULT_TOOL_CAPS, grepSkip: [".morph/", "decks/", "docs/TASK_"] };

function build(): { p: ReturnType<typeof tmpRoot>; tree: ScoutTree } {
  const p = tmpRoot("morph-p25tool-");
  p.write("t/docs/TASK_X.md", "hit task\n");
  p.write("t/docs/PLAN.md", "hit plan\n");
  p.write("t/decks/a.json", "hit deck\n");
  p.write("t/src/a.ts", "hit src\n");
  return { p, tree: { root: p.path("t"), files: ["docs/TASK_X.md", "docs/PLAN.md", "decks/a.json", "src/a.ts"] } };
}

test("Run Tool unchanged rows: bare names skip a top directory, a GREP in it lifts the skip (green on main)", () => {
  const { p, tree } = build();
  try {
    const grep = (path: string) => runTool({ kind: "grep", pattern: "hit", path }, tree, NODE_FS, DEFAULT_TOOL_CAPS);
    expect(grep("")).toStrictEqual({ text: "GREP /hit/ in the tree: 3 matches in 3 files\ndocs/PLAN.md:1: hit plan\ndocs/TASK_X.md:1: hit task\nsrc/a.ts:1: hit src", read: false, error: null });
    expect(grep("decks").text).toBe("GREP /hit/ in decks/: 1 match in 1 file\ndecks/a.json:1: hit deck");
  } finally { p.rm(); }
});

test("Run Tool example 8: grepSkip entries are path prefixes, a GREP that names one lifts it", () => {
  const { p, tree } = build();
  try {
    const grep = (path: string, caps: ToolCaps) => runTool({ kind: "grep", pattern: "hit", path }, tree, NODE_FS, caps);
    expect(grep("", K)).toStrictEqual({ text: "GREP /hit/ in the tree: 2 matches in 2 files\ndocs/PLAN.md:1: hit plan\nsrc/a.ts:1: hit src", read: false, error: null });
    expect(grep("docs", K)).toStrictEqual({ text: "GREP /hit/ in docs/: 2 matches in 2 files\ndocs/PLAN.md:1: hit plan\ndocs/TASK_X.md:1: hit task", read: false, error: null });
    expect(grep("decks", K)).toStrictEqual({ text: "GREP /hit/ in decks/: 1 match in 1 file\ndecks/a.json:1: hit deck", read: false, error: null });
    expect(grep("", { ...DEFAULT_TOOL_CAPS, grepSkip: ["decks"] })).toStrictEqual({ text: "GREP /hit/ in the tree: 3 matches in 3 files\ndocs/PLAN.md:1: hit plan\ndocs/TASK_X.md:1: hit task\nsrc/a.ts:1: hit src", read: false, error: null });
  } finally { p.rm(); }
});
