// P13a probe for cage-path by docs/TASK_P13a_scout.md §2.2 (Cage Path) — a path the model wrote, checked against the tree's
// listing and, for a file, resolved through realpath: absolute, "..", .git, unlisted, dangling and out-of-root symlinks
// refused with pinned messages. Record Cage Path examples 1-3 (3 on a real tmp tree with symlinks), then the §2.2 rows.
import { test, expect } from "vitest";
import fs from "node:fs";
import { tmpRoot } from "../../tests/helpers.js";
import { cagePath } from "../../src/scout/cagePath.js";
import type { Caged, ScoutFs, ScoutTree } from "../../src/scout/cagePath.js";

const MEM: ScoutFs = {
  realpath: (p: string): string => p,
  readFile: (p: string): string => { throw new Error("no read in the cage: " + p); },
};
const NODE_FS: ScoutFs = {
  realpath: (p: string): string => fs.realpathSync(p),
  readFile: (p: string): string => fs.readFileSync(p, "utf8"),
};
const ok = (p: string): Caged => ({ ok: true, path: p });
const no = (error: string): Caged => ({ ok: false, error });
const TREE: ScoutTree = { root: "/r", files: ["src/a.ts", "lib/b one.ts", "docs/n.md"] };

test("Cage Path example 1: listed files and directories, normalised", () => {
  expect(cagePath(TREE, "src/a.ts", "file", MEM)).toStrictEqual(ok("src/a.ts"));
  expect(cagePath(TREE, "./lib/b one.ts", "file", MEM)).toStrictEqual(ok("lib/b one.ts"));
  expect(cagePath(TREE, "src\\a.ts", "file", MEM)).toStrictEqual(ok("src/a.ts"));
  expect(cagePath(TREE, "src//./a.ts", "file", MEM)).toStrictEqual(ok("src/a.ts"));
  expect(cagePath(TREE, "src/", "dir", MEM)).toStrictEqual(ok("src"));
  expect(cagePath(TREE, "", "dir", MEM)).toStrictEqual(ok(""));
  expect(cagePath(TREE, ".", "dir", MEM)).toStrictEqual(ok(""));
});

test("Cage Path example 2: refusals before the file system", () => {
  expect(cagePath(TREE, "", "file", MEM)).toStrictEqual(no("empty path"));
  expect(cagePath(TREE, "/etc/passwd", "file", MEM)).toStrictEqual(no("absolute path refused: /etc/passwd"));
  expect(cagePath(TREE, "C:\\x.ts", "file", MEM)).toStrictEqual(no("absolute path refused: C:\\x.ts"));
  expect(cagePath(TREE, "../etc/passwd", "file", MEM)).toStrictEqual(no("path leaves the root: ../etc/passwd"));
  expect(cagePath(TREE, "src/../../x", "dir", MEM)).toStrictEqual(no("path leaves the root: src/../../x"));
  expect(cagePath(TREE, ".git/config", "file", MEM)).toStrictEqual(no("inside .git: .git/config"));
  expect(cagePath(TREE, "src/b.ts", "file", MEM)).toStrictEqual(no("not in the tree (missing, ignored or a directory): src/b.ts"));
  expect(cagePath(TREE, "src", "file", MEM)).toStrictEqual(no("not in the tree (missing, ignored or a directory): src"));
  expect(cagePath(TREE, "docs/n.md", "dir", MEM)).toStrictEqual(no("no such directory in the tree: docs/n.md"));
  expect(cagePath(TREE, "lib/b", "dir", MEM)).toStrictEqual(no("no such directory in the tree: lib/b"));
});

test("Cage Path example 3: symlinks on a real tmp tree — out of the root (a sibling with the root's prefix), inside, into .git, dangling; a symlinked root", () => {
  const p = tmpRoot("morph-cage-");
  try {
    p.write("t/src/a.ts", "a\n");
    p.write("t/.git/config", "[core]\n");
    p.write("t-out/secret.txt", "s\n");
    fs.symlinkSync(p.path("t-out/secret.txt"), p.path("t/out.txt"));
    fs.symlinkSync("src/a.ts", p.path("t/in.txt"));
    fs.symlinkSync(".git/config", p.path("t/gitcfg"));
    fs.symlinkSync("nowhere.ts", p.path("t/gone.ts"));
    fs.symlinkSync(p.path("t"), p.path("link"));
    const files = ["src/a.ts", "out.txt", "in.txt", "gitcfg", "gone.ts"];
    const tree: ScoutTree = { root: p.path("t"), files };
    expect(cagePath(tree, "out.txt", "file", NODE_FS)).toStrictEqual(no("symlink out of the root refused: out.txt"));
    expect(cagePath(tree, "in.txt", "file", NODE_FS)).toStrictEqual(ok("in.txt"));
    expect(cagePath(tree, "gitcfg", "file", NODE_FS)).toStrictEqual(no("inside .git: gitcfg"));
    expect(cagePath(tree, "gone.ts", "file", NODE_FS)).toStrictEqual(no("no such file: gone.ts"));
    const linked: ScoutTree = { root: p.path("link"), files };
    expect(cagePath(linked, "src/a.ts", "file", NODE_FS)).toStrictEqual(ok("src/a.ts"));
    expect(cagePath(linked, "out.txt", "file", NODE_FS)).toStrictEqual(no("symlink out of the root refused: out.txt"));
  } finally {
    p.rm();
  }
});

test("§2.2 rows: realpath of the root itself; a drive letter needs a slash; .git as any segment; a listed directory prefix", () => {
  const calls: string[] = [];
  const spy: ScoutFs = {
    realpath: (q: string): string => { calls.push(q); return q === "/r" ? "/real/r" : "/real" + q; },
    readFile: (q: string): string => q,
  };
  expect(cagePath(TREE, "src/a.ts", "file", spy)).toStrictEqual(ok("src/a.ts"));
  expect(calls).toContain("/r");
  expect(calls).toContain("/r/src/a.ts");
  const escape: ScoutFs = { realpath: (q: string): string => (q === "/r" ? "/r" : "/r-old/a.ts"), readFile: (q: string): string => q };
  expect(cagePath(TREE, "src/a.ts", "file", escape)).toStrictEqual(no("symlink out of the root refused: src/a.ts"));
  const lost: ScoutFs = { realpath: (q: string): string => { if (q !== "/r") throw new Error("ENOENT"); return q; }, readFile: (q: string): string => q };
  expect(cagePath(TREE, "./src/a.ts", "file", lost)).toStrictEqual(no("no such file: ./src/a.ts"));
  const self: ScoutFs = { realpath: (): string => "/r", readFile: (q: string): string => q };
  expect(cagePath(TREE, "src/a.ts", "file", self)).toStrictEqual(no("symlink out of the root refused: src/a.ts"));
  const colon: ScoutTree = { root: "/r", files: ["c:x.ts", "a/.gitkeep", "a/b/.git/h"] };
  expect(cagePath(colon, "c:x.ts", "file", MEM)).toStrictEqual(ok("c:x.ts"));
  expect(cagePath(colon, "a/.gitkeep", "file", MEM)).toStrictEqual(ok("a/.gitkeep"));
  expect(cagePath(colon, "a/b/.git/h", "file", MEM)).toStrictEqual(no("inside .git: a/b/.git/h"));
  expect(cagePath(colon, "a/b", "dir", MEM)).toStrictEqual(ok("a/b"));
  expect(cagePath(colon, "a\\b\\", "dir", MEM)).toStrictEqual(ok("a/b"));
  expect(cagePath(colon, "a/b/.git", "dir", MEM)).toStrictEqual(no("inside .git: a/b/.git"));
  expect(cagePath(colon, "a/..b", "dir", MEM)).toStrictEqual(no("no such directory in the tree: a/..b"));
});
