// P32 probe for open-branch by docs/TASK_P32_dirty.md §2.2 (src/git/branch.ts) — issue #43: every git status entry
// is dirty, .morph/ included; the refusal names the remedy. Record Component git, Open Run Branch examples 1–4.
// Examples 1 and 4 are unchanged (green on the stub = the current file, by design); 2 and 3 change.
import { test, expect } from "vitest";
import { openRunBranch } from "../../src/git/branch.js";
import { tmpRepo } from "../../tests/helpers.js";

const REMEDY = " (commit, remove or ignore them: every acceptance fails on a file left in the tree)";

function envOf(root: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "",
    HOME: root,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Ada",
    GIT_AUTHOR_EMAIL: "ada@example.invalid",
    GIT_COMMITTER_NAME: "Ada",
    GIT_COMMITTER_EMAIL: "ada@example.invalid",
  };
}

test("Open Run Branch example 1: a fresh repo opens morph/r1 at HEAD", () => {
  const r = tmpRepo();
  try {
    const head = r.git(["rev-parse", "HEAD"]);
    expect(openRunBranch(r.root, "r1", envOf(r.root))).toStrictEqual({ ok: true, branch: "morph/r1", base: head });
    expect(r.git(["rev-parse", "--abbrev-ref", "HEAD"])).toBe("morph/r1");
  } finally {
    r.rm();
  }
});

test("Open Run Branch example 2: untracked .morph/ files refuse without .gitignore, open with .morph/* ignored", () => {
  const r = tmpRepo();
  try {
    r.write(".morph/deck.json", "{}");
    r.write(".morph/runs/x/report.json", "{}");
    expect(openRunBranch(r.root, "r2", envOf(r.root))).toStrictEqual({
      ok: false,
      error: "dirty tree: .morph/deck.json, .morph/runs/x/report.json" + REMEDY,
    });
    expect(r.git(["rev-parse", "--abbrev-ref", "HEAD"])).toBe("main");
    expect(r.git(["for-each-ref", "refs/heads/morph/r2"])).toBe("");
    r.write(".gitignore", ".morph/*\n");
    r.git(["add", ".gitignore"]);
    r.git(["commit", "-q", "-m", "ignore"]);
    const head = r.git(["rev-parse", "HEAD"]);
    expect(openRunBranch(r.root, "r2", envOf(r.root))).toStrictEqual({ ok: true, branch: "morph/r2", base: head });
  } finally {
    r.rm();
  }
});

test("Open Run Branch example 3: a modified README.md and an untracked src/a.ts refuse", () => {
  const r = tmpRepo();
  try {
    r.write("README.md", "one");
    r.git(["add", "README.md"]);
    r.git(["commit", "-q", "-m", "readme"]);
    r.write("README.md", "two");
    r.write("src/a.ts", "export {};\n");
    expect(openRunBranch(r.root, "r3", envOf(r.root))).toStrictEqual({
      ok: false,
      error: "dirty tree: README.md, src/a.ts" + REMEDY,
    });
    expect(r.git(["rev-parse", "--abbrev-ref", "HEAD"])).toBe("main");
    expect(r.git(["for-each-ref", "refs/heads/morph/r3"])).toBe("");
  } finally {
    r.rm();
  }
});

test("Open Run Branch example 4: an existing branch refuses, then an invalid runId refuses", () => {
  const r = tmpRepo();
  try {
    r.git(["branch", "morph/r4"]);
    expect(openRunBranch(r.root, "r4", envOf(r.root))).toStrictEqual({ ok: false, error: "branch morph/r4 already exists" });
    expect(r.git(["rev-parse", "--abbrev-ref", "HEAD"])).toBe("main");
    expect(openRunBranch(r.root, "a b", envOf(r.root))).toStrictEqual({ ok: false, error: "invalid runId: a b" });
  } finally {
    r.rm();
  }
});
