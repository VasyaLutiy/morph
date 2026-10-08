import { expect, test } from "vitest";
import { readMorphLog } from "../../src/git/log.js";
import { gitOk } from "../../src/git/run.js";
import { tmpRepo, tmpRoot } from "../helpers.js";
import type { TmpRepo } from "../helpers.js";

const ENV = { PATH: process.env.PATH ?? "" };

const commit = (r: TmpRepo, subject: string, trailers: string, files: Record<string, string>): string => {
  for (const [k, v] of Object.entries(files)) r.write(k, v);
  if (Object.keys(files).length > 0) r.git(["add", "-A", "--", ...Object.keys(files)]);
  r.git(["commit", "-q", "--allow-empty", "-m", subject, ...(trailers === "" ? [] : ["-m", trailers])]);
  return r.git(["rev-parse", "HEAD"]);
};

test("Read Morph Log example 1: a card commit takes the run above it, a plain commit ends the run", () => {
  const r = tmpRepo();
  try {
    const z = commit(r, "z", "Morph-Card: z\nMorph-Model: m/w", { "src/z.ts": "z\n" });
    commit(r, "data", "", { "docs/n.md": "n\n" });
    const a = commit(r, "a", "Morph-Card: a\nMorph-Model: m/x\nMorph-Variant: a.v2\nMorph-Acceptance-Exit: 0", {
      "src/a.ts": "a\n",
    });
    commit(r, "run", "Morph-Run: 20261109-120000\nMorph-Cards: 1", {});
    const aJudge = commit(r, "a-judge", "Morph-Card: a-judge\nMorph-Model: m/y", {
      "src/a.ts": "a again\n",
      "tests/a.test.ts": "t\n",
    });

    expect(readMorphLog(r.root, ENV)).toStrictEqual([
      { sha: aJudge, card: "a-judge", model: "m/y", run: null, paths: ["src/a.ts", "tests/a.test.ts"] },
      { sha: a, card: "a", model: "m/x", run: "20261109-120000", paths: ["src/a.ts"] },
      { sha: z, card: "z", model: "m/w", run: null, paths: ["src/z.ts"] },
    ]);
  } finally {
    r.rm();
  }
});

test("Read Morph Log example 2: a rename counts both paths and a card without Morph-Model has model \"\"", () => {
  const r = tmpRepo();
  try {
    const run = commit(r, "deck as submitted", "Morph-Run: 20261110-080000-89abcdef", {});
    const b = commit(r, "b", "Morph-Card: b\nMorph-Model: glm53", { "lib/b one.ts": "b\n" });
    r.git(["mv", "lib/b one.ts", "lib/c.ts"]);
    const c = commit(r, "c", "Morph-Card: c", {});
    commit(r, "deck", "Morph-Run: 20261110-080000-89abcdef", {});

    expect(readMorphLog(r.root, ENV)).toStrictEqual([
      { sha: c, card: "c", model: "", run: "20261110-080000-89abcdef", paths: ["lib/b one.ts", "lib/c.ts"] },
      { sha: b, card: "b", model: "glm53", run: "20261110-080000-89abcdef", paths: ["lib/b one.ts"] },
    ]);
    expect(run).not.toBe("");
  } finally {
    r.rm();
  }
});

test("Read Morph Log example 3: a repository with no commit gives [], a non-repository throws", () => {
  const empty = tmpRoot();
  const plain = tmpRoot();
  try {
    gitOk(empty.root, ["init", "-q", "-b", "main"], ENV);
    expect(readMorphLog(empty.root, ENV)).toStrictEqual([]);

    let message = "";
    try {
      readMorphLog(plain.root, ENV);
    } catch (e: unknown) {
      message = e instanceof Error ? e.message : String(e);
    }
    expect(message.startsWith("git log failed (exit 128): ")).toBe(true);
  } finally {
    empty.rm();
    plain.rm();
  }
});
