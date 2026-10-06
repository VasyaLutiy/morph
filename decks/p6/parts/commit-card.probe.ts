// P6 probe for commit-card: commitPaths, commitCard and makeCommitHook by docs/TASK_P6_git.md §2.2,
// one test per record example (Component git, Functions Commit Paths and Commit Card), then the
// §2.2 rows: a binary file counts 0, a deleted target is staged, the hook is runloop's CommitHook.
import { test, expect, expectTypeOf } from "vitest";
import fs from "node:fs";
import { commitCard, commitPaths, makeCommitHook } from "../../src/git/commit.js";
import type { CardCommit, CardCommitter, CommitInfo, Trailer } from "../../src/git/types.js";
import type { CommitHook } from "../../src/runloop/types.js";
import { tmpRepo } from "../../tests/helpers.js";

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

test("Commit Paths example 1: only the paths are committed; hand-staged and untracked files stay", () => {
  const r = tmpRepo();
  try {
    r.write("other.txt", "o\n");
    r.git(["add", "other.txt"]);
    r.write("notes.txt", "n\n");
    r.write("src/a.ts", "export const a = 1;\n");
    const got = commitPaths(r.root, ["src/a.ts"], "s", [["K", "v"]], gitEnv(r.root));
    const head = r.git(["rev-parse", "HEAD"]);
    expect(got, "Commit Info").toStrictEqual({ commit: head, diffstat: { files: 1, insertions: 1, deletions: 0 } });
    expect(head, "sha").toMatch(/^[0-9a-f]{40}$/);
    expect(r.git(["log", "-1", "--format=%B"]), "message").toBe("s\n\nK: v");
    expect(r.git(["show", "--name-only", "--format=", "HEAD"]), "committed paths").toBe("src/a.ts");
    expect(r.git(["diff", "--cached", "--name-only"]), "other.txt still staged").toBe("other.txt");
    expect(r.git(["status", "--porcelain", "--", "notes.txt"]), "notes.txt still untracked").toBe("?? notes.txt");
    expect(r.git(["log", "-1", "--format=%an <%ae> %cn"]), "author and committer from the env").toBe("Ada <ada@example.invalid> Ada");
  } finally {
    r.rm();
  }
});

test("Commit Paths example 2: nothing changed gives null and no commit", () => {
  const r = tmpRepo();
  try {
    r.write("src/a.ts", "export const a = 1;\n");
    r.git(["add", "src/a.ts"]);
    r.git(["commit", "-q", "-m", "a"]);
    const before = r.git(["rev-parse", "HEAD"]);
    expect(commitPaths(r.root, ["src/a.ts"], "s", [["K", "v"]], gitEnv(r.root)) === null, "null").toBe(true);
    expect(r.git(["rev-parse", "HEAD"]), "HEAD unchanged").toBe(before);
  } finally {
    r.rm();
  }
});

test("Commit Card example 1: two new targets, subject and trailers without Morph-Variant", () => {
  const r = tmpRepo();
  try {
    r.git(["checkout", "-q", "-b", "morph/r1"]);
    r.write("src/a.ts", "export const a = 1;\n");
    r.write("src/b.ts", "export const b = 2;\nexport const c = 3;\n");
    const input: CardCommit = { customId: "a", targets: ["src/a.ts", "src/b.ts"], model: "glm53", variant: null, acceptanceExit: 0 };
    const got = commitCard(r.root, input, gitEnv(r.root));
    expect(got, "Commit Info").toStrictEqual({ commit: r.git(["rev-parse", "HEAD"]), diffstat: { files: 2, insertions: 3, deletions: 0 } });
    expect(r.git(["log", "-1", "--format=%B"]), "message").toBe(
      "morph a: src/a.ts, src/b.ts\n\nMorph-Card: a\nMorph-Model: glm53\nMorph-Acceptance-Exit: 0");
    expect(r.git(["log", "-1", "--format=%(trailers:key=Morph-Card,valueonly)"]), "trailer parsed by git").toBe("a");
  } finally {
    r.rm();
  }
});

test("Commit Card example 2: a modified target and Morph-Variant", () => {
  const r = tmpRepo();
  try {
    r.write("src/a.ts", "export const a = 1;\n");
    r.git(["add", "src/a.ts"]);
    r.git(["commit", "-q", "-m", "a"]);
    r.write("src/a.ts", "export const a = 2;\nexport const z = 0;\n");
    const got = commitCard(r.root, { customId: "c", targets: ["src/a.ts"], model: "glm53", variant: "c.v2", acceptanceExit: 0 },
      gitEnv(r.root));
    expect(got === null ? "null" : got.diffstat, "diffstat").toStrictEqual({ files: 1, insertions: 2, deletions: 1 });
    expect(r.git(["log", "-1", "--format=%B"]), "message").toBe(
      "morph c: src/a.ts\n\nMorph-Card: c\nMorph-Model: glm53\nMorph-Variant: c.v2\nMorph-Acceptance-Exit: 0");
  } finally {
    r.rm();
  }
});

test("Commit Card example 3: makeCommitHook, then nothing changed", () => {
  const r = tmpRepo();
  try {
    const hook = makeCommitHook(r.root, "stub", gitEnv(r.root));
    r.write("out/h.ts", "x\n");
    const first = hook("h", ["out/h.ts"]);
    const head = r.git(["rev-parse", "HEAD"]);
    expect(first, "first").toStrictEqual({ commit: head, diffstat: { files: 1, insertions: 1, deletions: 0 } });
    expect(r.git(["log", "-1", "--format=%B"]), "message").toBe(
      "morph h: out/h.ts\n\nMorph-Card: h\nMorph-Model: stub\nMorph-Acceptance-Exit: 0");
    expect(hook("h", ["out/h.ts"]) === null, "second is null").toBe(true);
    expect(r.git(["rev-parse", "HEAD"]), "HEAD unchanged").toBe(head);
  } finally {
    r.rm();
  }
});

test("§2.2: a binary file counts 0; a deleted target is staged and counted; Morph-Acceptance-Exit as given", () => {
  const r = tmpRepo();
  try {
    fs.writeFileSync(r.path("bin.dat"), Buffer.from([0xff, 0x00, 0xfe, 0x0a]));
    const bin = commitPaths(r.root, ["bin.dat"], "bin", [["K", "v"]], gitEnv(r.root));
    expect(bin === null ? "null" : bin.diffstat, "binary").toStrictEqual({ files: 1, insertions: 0, deletions: 0 });
    r.write("gone.ts", "a\nb\n");
    r.git(["add", "gone.ts"]);
    r.git(["commit", "-q", "-m", "gone"]);
    fs.rmSync(r.path("gone.ts"));
    const del = commitCard(r.root, { customId: "d", targets: ["gone.ts"], model: "m", variant: null, acceptanceExit: 7 }, gitEnv(r.root));
    expect(del === null ? "null" : del.diffstat, "deletion").toStrictEqual({ files: 1, insertions: 0, deletions: 2 });
    expect(r.git(["log", "-1", "--format=%(trailers:key=Morph-Acceptance-Exit,valueonly)"]), "exit trailer").toBe("7");
    expect(r.git(["ls-files", "gone.ts"]), "gone.ts removed from the index").toBe("");
  } finally {
    r.rm();
  }
});

test("§2.2: the types; makeCommitHook is runloop's CommitHook", () => {
  const hook: CommitHook = makeCommitHook("/nonexistent", "m", {});
  expect(typeof hook, "a function").toBe("function");
  expectTypeOf(makeCommitHook).returns.toEqualTypeOf<CardCommitter>();
  expectTypeOf<CardCommitter>().toMatchTypeOf<CommitHook>();
  expectTypeOf(commitPaths).parameters.toEqualTypeOf<[string, string[], string, Trailer[], Record<string, string>]>();
  expectTypeOf(commitPaths).returns.toEqualTypeOf<CommitInfo | null>();
  expectTypeOf(commitCard).parameters.toEqualTypeOf<[string, CardCommit, Record<string, string>]>();
  expectTypeOf<CardCommit>().toEqualTypeOf<{ customId: string; targets: string[]; model: string; variant: string | null; acceptanceExit: number }>();
  expectTypeOf<Trailer>().toEqualTypeOf<[string, string]>();
});
