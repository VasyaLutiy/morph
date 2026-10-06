// P6 probe for open-branch: openRunBranch by docs/TASK_P6_git.md §2.2, one test per record example
// (Component git, Function Open Run Branch), then the §2.2 rows: a staged rename, a modified
// tracked file under .morph/, no git call for an invalid id, a git fault thrown, the types.
import { test, expect, expectTypeOf } from "vitest";
import { openRunBranch } from "../../src/git/branch.js";
import type { BranchResult } from "../../src/git/types.js";
import { tmpRepo, tmpRoot } from "../../tests/helpers.js";

function gitEnv(home: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "",
    HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Ada",
    GIT_AUTHOR_EMAIL: "ada@example.invalid",
    GIT_COMMITTER_NAME: "Ada",
    GIT_COMMITTER_EMAIL: "ada@example.invalid",
  };
}
const thrown = (f: () => unknown): string => {
  try {
    f();
  } catch (e: unknown) {
    return e instanceof Error ? e.message : "non-Error thrown: " + String(e);
  }
  return "did not throw";
};

test("Open Run Branch example 1: morph/r1 from HEAD", () => {
  const r = tmpRepo();
  try {
    const h = r.git(["rev-parse", "HEAD"]);
    expect(h, "base sha").toMatch(/^[0-9a-f]{40}$/);
    expect(openRunBranch(r.root, "r1", gitEnv(r.root)), "result").toStrictEqual({ ok: true, branch: "morph/r1", base: h });
    expect(r.git(["rev-parse", "--abbrev-ref", "HEAD"]), "checkout").toBe("morph/r1");
  } finally {
    r.rm();
  }
});

test("Open Run Branch example 2: untracked files under .morph/ are not dirty", () => {
  const r = tmpRepo();
  try {
    const h = r.git(["rev-parse", "HEAD"]);
    r.write(".morph/deck.json", "[]\n");
    r.write(".morph/runs/x/report.json", "{}\n");
    expect(openRunBranch(r.root, "r2", gitEnv(r.root)), "result").toStrictEqual({ ok: true, branch: "morph/r2", base: h });
  } finally {
    r.rm();
  }
});

test("Open Run Branch example 3: a dirty tree outside .morph/ is refused, paths sorted", () => {
  const r = tmpRepo();
  try {
    r.write("README.md", "one\n");
    r.git(["add", "README.md"]);
    r.git(["commit", "-q", "-m", "readme"]);
    r.write("README.md", "two\n");
    r.write("src/a.ts", "x\n");
    expect(openRunBranch(r.root, "r3", gitEnv(r.root)), "result").toStrictEqual({
      ok: false,
      error: "dirty tree outside .morph/: README.md, src/a.ts",
    });
    expect(r.git(["rev-parse", "--abbrev-ref", "HEAD"]), "checkout unchanged").toBe("main");
    expect(r.git(["branch", "--list", "morph/r3"]), "no branch morph/r3").toBe("");
  } finally {
    r.rm();
  }
});

test("Open Run Branch example 4: an existing branch, then an invalid runId", () => {
  const r = tmpRepo();
  try {
    r.git(["branch", "morph/r4"]);
    expect(openRunBranch(r.root, "r4", gitEnv(r.root)), "existing").toStrictEqual({
      ok: false,
      error: "branch morph/r4 already exists",
    });
    expect(r.git(["rev-parse", "--abbrev-ref", "HEAD"]), "checkout unchanged").toBe("main");
    expect(openRunBranch(r.root, "a b", gitEnv(r.root)), "invalid").toStrictEqual({ ok: false, error: "invalid runId: a b" });
  } finally {
    r.rm();
  }
});

test("§2.2: a staged rename names the new path; a modified tracked file under .morph/ is not dirty", () => {
  const r = tmpRepo();
  try {
    r.write("old.txt", "x\n");
    r.write(".morph/state.json", "1\n");
    r.git(["add", "old.txt", ".morph/state.json"]);
    r.git(["commit", "-q", "-m", "two files"]);
    r.write(".morph/state.json", "2\n");
    expect(openRunBranch(r.root, "m1", gitEnv(r.root)).ok, "only .morph/ modified").toBe(true);
    r.git(["checkout", "-q", "main"]);
    r.git(["mv", "old.txt", "new.txt"]);
    expect(openRunBranch(r.root, "m2", gitEnv(r.root)), "rename").toStrictEqual({
      ok: false,
      error: "dirty tree outside .morph/: new.txt",
    });
  } finally {
    r.rm();
  }
});

test("§2.2: dirty paths are sorted, not in git's order (tracked changes before untracked)", () => {
  const r = tmpRepo();
  try {
    r.write("z.md", "one\n");
    r.git(["add", "z.md"]);
    r.git(["commit", "-q", "-m", "z"]);
    r.write("z.md", "two\n");
    r.write("a.txt", "x\n");
    expect(r.git(["status", "--porcelain", "--untracked-files=all"]), "git's order").toBe("M z.md\n?? a.txt");
    expect(openRunBranch(r.root, "s1", gitEnv(r.root)), "sorted").toStrictEqual({
      ok: false,
      error: "dirty tree outside .morph/: a.txt, z.md",
    });
  } finally {
    r.rm();
  }
});

test("§2.2: an invalid runId makes no git call; a git fault is a thrown Error", () => {
  const t = tmpRoot();
  try {
    expect(openRunBranch(t.root, "x/y", gitEnv(t.root)), "invalid id outside any repo").toStrictEqual({
      ok: false,
      error: "invalid runId: x/y",
    });
    const env = { ...gitEnv(t.root), GIT_CEILING_DIRECTORIES: t.root };
    const msg = thrown(() => openRunBranch(t.root, "ok1", env));
    expect(msg.startsWith("git status failed (exit 128): fatal: not a git repository"), "not a repo: " + msg).toBe(true);
  } finally {
    t.rm();
  }
});

test("§2.2: the types", () => {
  expectTypeOf(openRunBranch).returns.toEqualTypeOf<BranchResult>();
  expectTypeOf(openRunBranch).parameters.toEqualTypeOf<[string, string, Record<string, string>]>();
  expectTypeOf<BranchResult>().toEqualTypeOf<{ ok: true; branch: string; base: string } | { ok: false; error: string }>();
});
