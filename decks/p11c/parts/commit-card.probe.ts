// P11c probe for commit-card by docs/TASK_P11c_runner.md §2.2 (issue #5 finding 1) — Commit Card stages its targets
// with `git add -A -f`, so a target under a .gitignore'd path is committed and the hook never throws on it; Commit Paths
// keeps its plain `git add -A` (Archive Run example 3 relies on its refusal). Record Commit Card example 4, then rows.
import { test, expect } from "vitest";
import { commitCard, commitPaths, makeCommitHook } from "../../src/git/commit.js";
import { tmpRepo } from "../../tests/helpers.js";

function gitEnv(home: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "", HOME: home, GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@example.invalid",
    GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL: "ada@example.invalid",
  };
}

test("Commit Card example 4: a target under an ignored path is committed; the hook never throws on it", () => {
  const r = tmpRepo();
  try {
    r.write(".gitignore", "out/\n");
    r.git(["add", ".gitignore"]);
    r.git(["commit", "-q", "-m", "ignore out"]);
    r.write("out/g.ts", "y\n");
    const hook = makeCommitHook(r.root, "m2", gitEnv(r.root));
    const got = hook("g", ["out/g.ts"]);
    expect(got, "commit info").toStrictEqual({ commit: r.git(["rev-parse", "HEAD"]), diffstat: { files: 1, insertions: 1, deletions: 0 } });
    expect(r.git(["show", "--name-only", "--format=", "HEAD"]), "paths").toBe("out/g.ts");
    expect(r.git(["log", "-1", "--format=%B"]), "message").toBe("morph g: out/g.ts\n\nMorph-Card: g\nMorph-Model: m2\nMorph-Acceptance-Exit: 0");
    expect(hook("g", ["out/g.ts"]), "unchanged: null").toBe(null);
  } finally {
    r.rm();
  }
});

test("§2.2 rows: commitCard forces too; Commit Paths still refuses an ignored path; only the targets are staged", () => {
  const r = tmpRepo();
  try {
    r.write(".gitignore", "gen/\n*.log\n");
    r.git(["add", ".gitignore"]);
    r.git(["commit", "-q", "-m", "ignore gen"]);
    r.write("gen/k.ts", "k\nk\n");
    r.write("gen/other.ts", "o\n");
    r.write("run.log", "l\n");
    const env = gitEnv(r.root);
    const info = commitCard(r.root, { customId: "k", targets: ["gen/k.ts"], model: "m3", variant: "k.v2", acceptanceExit: 0 }, env);
    expect(`${info?.diffstat.files} ${info?.diffstat.insertions}`, "commitCard").toBe("1 2");
    expect(r.git(["show", "--name-only", "--format=", "HEAD"]), "only the target").toBe("gen/k.ts");
    let message = "no throw";
    try {
      commitPaths(r.root, ["run.log"], "s", [], env);
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    expect(message.startsWith("git add failed (exit 1): "), message).toBe(true);
    expect(r.git(["status", "--porcelain", "--ignored"]), "the rest untouched").toBe("!! gen/other.ts\n!! run.log");
  } finally {
    r.rm();
  }
});
