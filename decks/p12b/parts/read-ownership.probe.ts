// P12b probe for read-ownership by docs/TASK_P12b_primer.md §2.2 (Read Ownership) — the Morph log folded per path: paths
// in order of first appearance (most recently written first), each path's writes newest first, models counted in order
// of first appearance. Record Read Ownership examples 1-2, then the §2.2 rows.
import { test, expect } from "vitest";
import { readOwnership } from "../../src/git/ownership.js";
import type { Ownership, OwnershipCommit } from "../../src/git/ownership.js";

test("Read Ownership example 1: three commits folded per path", () => {
  const commits: OwnershipCommit[] = [
    { card: "p-judge", model: "acme/q", run: null, paths: ["tests/p.test.ts", "src/p.ts"] },
    { card: "p", model: "acme/r", run: "20261109-120000", paths: ["src/p.ts"] },
    { card: "o", model: "acme/q", run: "20261109-120000", paths: ["src/o.ts", "src/p.ts"] },
  ];
  const pj = { card: "p-judge", model: "acme/q", run: null };
  const p = { card: "p", model: "acme/r", run: "20261109-120000" };
  const o = { card: "o", model: "acme/q", run: "20261109-120000" };
  const want: Ownership = {
    commits: 3,
    models: [{ model: "acme/q", commits: 2 }, { model: "acme/r", commits: 1 }],
    paths: [{ path: "tests/p.test.ts", writes: [pj] }, { path: "src/p.ts", writes: [pj, p, o] }, { path: "src/o.ts", writes: [o] }],
  };
  expect(readOwnership(commits)).toStrictEqual(want);
});

test("Read Ownership example 2: none; an empty model kept, a repeated path counted once, a commit without paths", () => {
  expect(readOwnership([])).toStrictEqual({ commits: 0, models: [], paths: [] });
  expect(readOwnership([
    { card: "x", model: "", run: null, paths: ["d/x", "d/x"] },
    { card: "y", model: "", run: "r", paths: [] },
  ])).toStrictEqual({ commits: 2, models: [{ model: "", commits: 2 }], paths: [{ path: "d/x", writes: [{ card: "x", model: "", run: null }] }] });
});

test("§2.2 rows: extra keys of a commit are not copied; the input is not changed; a path written twice by one card", () => {
  const commits = [
    { sha: "s1", card: "k", model: "m/b", run: "R", paths: ["b", "a"] },
    { sha: "s2", card: "k", model: "m/a", run: null, paths: ["a"] },
    { sha: "s3", card: "j", model: "m/b", run: null, paths: ["c"] },
  ];
  const before = JSON.stringify(commits);
  const got = readOwnership(commits);
  expect(JSON.stringify(got)).toBe(JSON.stringify({
    commits: 3,
    models: [{ model: "m/b", commits: 2 }, { model: "m/a", commits: 1 }],
    paths: [
      { path: "b", writes: [{ card: "k", model: "m/b", run: "R" }] },
      { path: "a", writes: [{ card: "k", model: "m/b", run: "R" }, { card: "k", model: "m/a", run: null }] },
      { path: "c", writes: [{ card: "j", model: "m/b", run: null }] },
    ],
  }));
  expect(JSON.stringify(commits)).toBe(before);
});
