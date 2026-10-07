// P12b probe for read-morph-log by docs/TASK_P12b_primer.md §2.2 (Read Morph Log) — one git log of HEAD's history, the
// Morph-Card commits newest first with card, model, run (from the run commits above them, ended by any other commit) and
// paths (-z, no renames). Record Read Morph Log examples 1-3, then the §2.2 rows.
import { test, expect } from "vitest";
import { MORPH_LOG_FORMAT, readMorphLog } from "../../src/git/log.js";
import { gitOk } from "../../src/git/run.js";
import type { MorphCommit } from "../../src/git/log.js";
import { tmpRepo, tmpRoot } from "../../tests/helpers.js";
import type { TmpRepo } from "../../tests/helpers.js";

const ENV = { PATH: process.env.PATH ?? "" };
const commit = (r: TmpRepo, subject: string, trailers: string, files: Record<string, string>): string => {
  for (const [k, v] of Object.entries(files)) r.write(k, v);
  if (Object.keys(files).length > 0) r.git(["add", "-A", "--", ...Object.keys(files)]);
  r.git(["commit", "-q", "--allow-empty", "-m", subject, ...(trailers === "" ? [] : ["-m", trailers])]);
  return r.git(["rev-parse", "HEAD"]);
};

test("Read Morph Log example 1: cards newest first; a run reaches the cards below it; any other commit ends it", () => {
  const r = tmpRepo();
  try {
    const z = commit(r, "morph z: src/z.ts", "Morph-Card: z\nMorph-Model: m/w", { "src/z.ts": "z\n" });
    commit(r, "data", "", { "docs/n.md": "n\n" });
    const a = commit(r, "morph a: src/a.ts", "Morph-Card: a\nMorph-Model: m/x\nMorph-Variant: a.v2\nMorph-Acceptance-Exit: 0", { "src/a.ts": "1\n" });
    commit(r, "morph run 20261109-120000: deck and report", "Morph-Run: 20261109-120000\nMorph-Cards: 1", {});
    const j = commit(r, "morph a-judge", "Morph-Card: a-judge\nMorph-Model: m/y", { "src/a.ts": "2\n", "tests/a.test.ts": "t\n" });
    const got: MorphCommit[] = readMorphLog(r.root, ENV);
    expect(got).toStrictEqual([
      { sha: j, card: "a-judge", model: "m/y", run: null, paths: ["src/a.ts", "tests/a.test.ts"] },
      { sha: a, card: "a", model: "m/x", run: "20261109-120000", paths: ["src/a.ts"] },
      { sha: z, card: "z", model: "m/w", run: null, paths: ["src/z.ts"] },
    ]);
  } finally {
    r.rm();
  }
});

test("Read Morph Log example 2: the mrph shape, a path with a space, a rename as two paths, no model trailer", () => {
  const r = tmpRepo();
  try {
    commit(r, "morph run 20261110-080000-89abcdef: the deck as submitted", "Morph-Run: 20261110-080000-89abcdef", {});
    const b = commit(r, "morph b", "Morph-Card: b\nMorph-Model: glm53", { "lib/b one.ts": "b\n" });
    r.git(["mv", "lib/b one.ts", "lib/c.ts"]);
    const c = commit(r, "morph c", "Morph-Card: c", {});
    commit(r, "morph run 20261110-080000-89abcdef: deck and report", "Morph-Run: 20261110-080000-89abcdef", {});
    expect(readMorphLog(r.root, ENV)).toStrictEqual([
      { sha: c, card: "c", model: "", run: "20261110-080000-89abcdef", paths: ["lib/b one.ts", "lib/c.ts"] },
      { sha: b, card: "b", model: "glm53", run: "20261110-080000-89abcdef", paths: ["lib/b one.ts"] },
    ]);
  } finally {
    r.rm();
  }
});

test("Read Morph Log example 3: no commit yet gives []; no repository throws git log's error", () => {
  const e = tmpRoot();
  const n = tmpRoot();
  try {
    gitOk(e.root, ["init", "-q"], ENV);
    expect(readMorphLog(e.root, ENV), "no commit").toStrictEqual([]);
    let message = "no throw";
    try {
      readMorphLog(n.root, ENV);
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message.startsWith("git log failed (exit 128): "), `thrown: ${message}`).toBe(true);
  } finally {
    e.rm();
    n.rm();
  }
});

test("§2.2 rows: the format constant; trailer values trimmed, the first of two kept; an empty card commit; the reset after a run", () => {
  expect(MORPH_LOG_FORMAT).toBe(
    "%x1e%H%x1f%(trailers:key=Morph-Card,valueonly,separator=%x1d)%x1f%(trailers:key=Morph-Model,valueonly,separator=%x1d)%x1f%(trailers:key=Morph-Run,valueonly,separator=%x1d)%x1f");
  const r = tmpRepo();
  try {
    const p = commit(r, "morph p", "Morph-Card: p\nMorph-Card: p2\nMorph-Model: m/1\nMorph-Model: m/2", { "x/p.ts": "p\n" });
    commit(r, "morph run R-1", "Morph-Run: R-1", {});
    const q = commit(r, "morph q", "Morph-Card: q\nMorph-Model: m/3", {});
    commit(r, "morph run R-2", "Morph-Run: R-2", {});
    commit(r, "plain", "", { "y.md": "y\n" });
    const s = commit(r, "morph s", "Morph-Card: s\nMorph-Model: m/4", { "a/s.ts": "s\n", "b/s.ts": "s\n" });
    expect(readMorphLog(r.root, ENV)).toStrictEqual([
      { sha: s, card: "s", model: "m/4", run: null, paths: ["a/s.ts", "b/s.ts"] },
      { sha: q, card: "q", model: "m/3", run: "R-2", paths: [] },
      { sha: p, card: "p", model: "m/1", run: "R-1", paths: ["x/p.ts"] },
    ]);
  } finally {
    r.rm();
  }
});
