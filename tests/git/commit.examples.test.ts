import { expect, test } from "vitest";
import fs from "node:fs";
import { commitPaths, commitCard, makeCommitHook } from "../../src/git/commit.js";
import type { CommitHook } from "../../src/runloop/types.js";
import { tmpRepo } from "../helpers.js";

function envFor(root: string): Record<string, string> {
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

test("Commit Paths example 1: stages only the targets, hand-staged and untracked files untouched", () => {
  const r = tmpRepo();
  try {
    const env = envFor(r.root);
    r.write("other.txt", "other\n");
    r.git(["add", "other.txt"]);
    r.write("notes.txt", "notes\n");
    r.write("src/a.ts", "export const a = 1;\n");
    const info = commitPaths(r.root, ["src/a.ts"], "s", [["K", "v"]], env);
    const head = r.git(["rev-parse", "HEAD"]);
    expect(head).toMatch(/^[0-9a-f]{40}$/);
    expect(info).toStrictEqual({
      commit: head,
      diffstat: { files: 1, insertions: 1, deletions: 0 },
    });
    expect(r.git(["log", "-1", "--format=%B"])).toBe("s\n\nK: v");
    expect(r.git(["show", "--name-only", "--format=", "HEAD"])).toBe("src/a.ts");
    expect(r.git(["diff", "--cached", "--name-only"])).toBe("other.txt");
    expect(r.git(["status", "--porcelain", "--", "notes.txt"])).toBe("?? notes.txt");
  } finally {
    r.rm();
  }
});

test("Commit Paths example 2: a byte-identical rewrite returns null and leaves HEAD alone", () => {
  const r = tmpRepo();
  try {
    const env = envFor(r.root);
    r.write("src/a.ts", "export const a = 1;\n");
    r.git(["add", "src/a.ts"]);
    r.git(["commit", "-q", "-m", "base"]);
    const head = r.git(["rev-parse", "HEAD"]);
    const info = commitPaths(r.root, ["src/a.ts"], "s", [["K", "v"]], env);
    expect(info).toBe(null);
    expect(r.git(["rev-parse", "HEAD"])).toBe(head);
  } finally {
    r.rm();
  }
});

test("Commit Card example 1: two new files, Morph trailers, trailer value readable", () => {
  const r = tmpRepo();
  try {
    const env = envFor(r.root);
    r.git(["checkout", "-q", "-b", "morph/r1"]);
    r.write("src/a.ts", "export const a = 1;\n");
    r.write("src/b.ts", "export const b = 2;\nexport const c = 3;\n");
    const info = commitCard(
      r.root,
      { customId: "a", targets: ["src/a.ts", "src/b.ts"], model: "glm53", variant: null, acceptanceExit: 0 },
      env
    );
    const head = r.git(["rev-parse", "HEAD"]);
    expect(head).toMatch(/^[0-9a-f]{40}$/);
    expect(info).toStrictEqual({
      commit: head,
      diffstat: { files: 2, insertions: 3, deletions: 0 },
    });
    expect(r.git(["log", "-1", "--format=%B"])).toBe(
      "morph a: src/a.ts, src/b.ts\n\nMorph-Card: a\nMorph-Model: glm53\nMorph-Acceptance-Exit: 0"
    );
    expect(r.git(["log", "-1", "--format=%(trailers:key=Morph-Card,valueonly)"])).toBe("a");
  } finally {
    r.rm();
  }
});

test("Commit Card example 2: a modified file with a variant trailer", () => {
  const r = tmpRepo();
  try {
    const env = envFor(r.root);
    r.write("src/a.ts", "export const a = 1;\n");
    r.git(["add", "src/a.ts"]);
    r.git(["commit", "-q", "-m", "base"]);
    r.write("src/a.ts", "export const a = 2;\nexport const z = 0;\n");
    const info = commitCard(
      r.root,
      { customId: "c", targets: ["src/a.ts"], model: "glm53", variant: "c.v2", acceptanceExit: 0 },
      env
    );
    const diffstat = info === null ? null : info.diffstat;
    expect(diffstat).toStrictEqual({ files: 1, insertions: 2, deletions: 1 });
    expect(r.git(["log", "-1", "--format=%B"])).toBe(
      "morph c: src/a.ts\n\nMorph-Card: c\nMorph-Model: glm53\nMorph-Variant: c.v2\nMorph-Acceptance-Exit: 0"
    );
  } finally {
    r.rm();
  }
});

test("Commit Card example 3: the hook commits once, the second call is null and HEAD stands", () => {
  const r = tmpRepo();
  try {
    const env = envFor(r.root);
    const hook = makeCommitHook(r.root, "stub", env);
    r.write("out/h.ts", "x\n");
    const first = hook("h", ["out/h.ts"]);
    const head = r.git(["rev-parse", "HEAD"]);
    expect(first).toStrictEqual({
      commit: head,
      diffstat: { files: 1, insertions: 1, deletions: 0 },
    });
    expect(r.git(["log", "-1", "--format=%B"])).toBe(
      "morph h: out/h.ts\n\nMorph-Card: h\nMorph-Model: stub\nMorph-Acceptance-Exit: 0"
    );
    const second = hook("h", ["out/h.ts"]);
    expect(second).toBe(null);
    expect(r.git(["rev-parse", "HEAD"])).toBe(head);
  } finally {
    r.rm();
  }
});

test("Commit Paths own: a deleted target is staged by -A and its deletions counted", () => {
  const r = tmpRepo();
  try {
    const env = envFor(r.root);
    r.write("src/gone.ts", "g\n");
    r.git(["add", "src/gone.ts"]);
    r.git(["commit", "-q", "-m", "base"]);
    fs.rmSync(r.path("src/gone.ts"));
    const info = commitPaths(r.root, ["src/gone.ts"], "del", [["K", "v"]], env);
    expect(info).toStrictEqual({
      commit: r.git(["rev-parse", "HEAD"]),
      diffstat: { files: 1, insertions: 0, deletions: 1 },
    });
  } finally {
    r.rm();
  }
});

test("Commit Paths own: a binary file counts 0 insertions and 0 deletions", () => {
  const r = tmpRepo();
  try {
    const env = envFor(r.root);
    fs.writeFileSync(r.path("bin.dat"), new Uint8Array([0, 1, 2, 3]));
    const info = commitPaths(r.root, ["bin.dat"], "bin", [["K", "v"]], env);
    expect(info).toStrictEqual({
      commit: r.git(["rev-parse", "HEAD"]),
      diffstat: { files: 1, insertions: 0, deletions: 0 },
    });
  } finally {
    r.rm();
  }
});

test("Commit Paths own: several trailers are joined into one block of lines", () => {
  const r = tmpRepo();
  try {
    const env = envFor(r.root);
    r.write("t.txt", "1\n");
    const info = commitPaths(r.root, ["t.txt"], "subj", [["A", "1"], ["B", "2"]], env);
    expect(info).not.toBe(null);
    expect(r.git(["log", "-1", "--format=%B"])).toBe("subj\n\nA: 1\nB: 2");
  } finally {
    r.rm();
  }
});

test("Commit Paths own: an untracked file outside the pathspec is not committed", () => {
  const r = tmpRepo();
  try {
    const env = envFor(r.root);
    r.write("src/a.ts", "a\n");
    r.write("side.txt", "side\n");
    const info = commitPaths(r.root, ["src/a.ts"], "s", [["K", "v"]], env);
    expect(info).not.toBe(null);
    expect(r.git(["show", "--name-only", "--format=", "HEAD"])).toBe("src/a.ts");
    expect(r.git(["status", "--porcelain", "--", "side.txt"])).toBe("?? side.txt");
  } finally {
    r.rm();
  }
});

test("Commit Card own: the acceptance exit is recorded exactly as given", () => {
  const r = tmpRepo();
  try {
    const env = envFor(r.root);
    r.write("src/e.ts", "e\n");
    const info = commitCard(
      r.root,
      { customId: "e", targets: ["src/e.ts"], model: "glm53", variant: null, acceptanceExit: 3 },
      env
    );
    expect(info).not.toBe(null);
    expect(r.git(["log", "-1", "--format=%B"])).toBe(
      "morph e: src/e.ts\n\nMorph-Card: e\nMorph-Model: glm53\nMorph-Acceptance-Exit: 3"
    );
  } finally {
    r.rm();
  }
});

test("Commit Card own: a hand-staged file is not swept into the card's commit", () => {
  const r = tmpRepo();
  try {
    const env = envFor(r.root);
    r.write("other.txt", "other\n");
    r.git(["add", "other.txt"]);
    r.write("src/x.ts", "x\n");
    const info = commitCard(
      r.root,
      { customId: "x", targets: ["src/x.ts"], model: "glm53", variant: null, acceptanceExit: 0 },
      env
    );
    expect(info).not.toBe(null);
    expect(r.git(["show", "--name-only", "--format=", "HEAD"])).toBe("src/x.ts");
    expect(r.git(["diff", "--cached", "--name-only"])).toBe("other.txt");
  } finally {
    r.rm();
  }
});

test("Commit Card own: the hook is a CommitHook and writes no Morph-Variant", () => {
  const r = tmpRepo();
  try {
    const env = envFor(r.root);
    const hook: CommitHook = makeCommitHook(r.root, "stub", env);
    r.write("out/v.ts", "v\n");
    const info = hook("v", ["out/v.ts"]);
    expect(info).toStrictEqual({
      commit: r.git(["rev-parse", "HEAD"]),
      diffstat: { files: 1, insertions: 1, deletions: 0 },
    });
    const message = r.git(["log", "-1", "--format=%B"]);
    expect(message).toBe("morph v: out/v.ts\n\nMorph-Card: v\nMorph-Model: stub\nMorph-Acceptance-Exit: 0");
    expect(message.includes("Morph-Variant")).toBe(false);
  } finally {
    r.rm();
  }
});

test("Commit Card own: the given env names Ada as author and committer", () => {
  const r = tmpRepo();
  try {
    const env = envFor(r.root);
    r.write("src/id.ts", "id\n");
    const info = commitCard(
      r.root,
      { customId: "id", targets: ["src/id.ts"], model: "glm53", variant: null, acceptanceExit: 0 },
      env
    );
    expect(info).not.toBe(null);
    expect(r.git(["log", "-1", "--format=%an <%ae> %cn"])).toBe("Ada <ada@example.invalid> Ada");
  } finally {
    r.rm();
  }
});
