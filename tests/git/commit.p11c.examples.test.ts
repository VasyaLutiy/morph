import { expect, test } from "vitest";
import { makeCommitHook } from "../../src/git/commit.js";
import { tmpRepo } from "../helpers.js";

const gitEnv = (home: string): Record<string, string> => ({
  PATH: process.env.PATH ?? "",
  HOME: home,
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Ada",
  GIT_AUTHOR_EMAIL: "ada@example.invalid",
  GIT_COMMITTER_NAME: "Ada",
  GIT_COMMITTER_EMAIL: "ada@example.invalid",
});

test("Commit Card example 4: an ignored target is committed with force", () => {
  const r = tmpRepo();
  try {
    r.write(".gitignore", "out/\n");
    r.git(["add", "-A"]);
    r.git(["commit", "-q", "-m", "gitignore"]);
    const env = gitEnv(r.root);
    const hook = makeCommitHook(r.root, "m2", env);
    r.write("out/g.ts", "y\n");
    const result = hook("g", ["out/g.ts"]);
    const head = r.git(["rev-parse", "HEAD"]);
    expect(result).toStrictEqual({
      commit: head,
      diffstat: { files: 1, insertions: 1, deletions: 0 },
    });
    expect(r.git(["show", "--name-only", "--format=", "HEAD"])).toBe("out/g.ts");
    expect(r.git(["log", "-1", "--format=%B"])).toBe(
      "morph g: out/g.ts\n\nMorph-Card: g\nMorph-Model: m2\nMorph-Acceptance-Exit: 0",
    );
  } finally {
    r.rm();
  }
});
