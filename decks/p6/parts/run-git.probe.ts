// P6 probe for run-git: runGit and gitOk by docs/TASK_P6_git.md §2.2, one test per record example
// (Component git, Function Run Git), then the §2.2 rows: gitOk's stdout, a spawn failure, the types.
// Every repo is a tmpRepo under the OS tmpdir; the env is given whole (no host git config).
import { test, expect, expectTypeOf } from "vitest";
import { gitOk, runGit } from "../../src/git/run.js";
import type { GitResult } from "../../src/git/types.js";
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
const thrown = (f: () => unknown): string => {
  try {
    f();
  } catch (e: unknown) {
    return e instanceof Error ? e.message : "non-Error thrown: " + String(e);
  }
  return "did not throw";
};

test("Run Git example 1: rev-parse on a fresh repo", () => {
  const r = tmpRepo();
  try {
    const got = runGit(r.root, ["rev-parse", "--abbrev-ref", "HEAD"], gitEnv(r.root));
    expect(got, "runGit result").toStrictEqual({ code: 0, stdout: "main\n", stderr: "" });
  } finally {
    r.rm();
  }
});

test("Run Git example 2: LC_ALL and GIT_TERMINAL_PROMPT forced, the given env passed, nothing leaks", () => {
  const r = tmpRepo();
  try {
    const env = { ...gitEnv(r.root), FOO: "bar", LC_ALL: "de_DE.UTF-8" };
    const args = ["-c", 'alias.envs=!echo "$LC_ALL $GIT_TERMINAL_PROMPT $FOO ${USER-unset}"', "envs"];
    expect(runGit(r.root, args, env), "child env").toStrictEqual({ code: 0, stdout: "C 0 bar unset\n", stderr: "" });
  } finally {
    r.rm();
  }
});

test("Run Git example 3: a failing command is a result for runGit and a thrown Error for gitOk", () => {
  const r = tmpRepo();
  try {
    const got = runGit(r.root, ["checkout", "nope"], gitEnv(r.root));
    expect(`${got.code} [${got.stdout}]`, "exit and stdout").toBe("1 []");
    expect(got.stderr.startsWith("error: pathspec 'nope' did not match"), "stderr: " + got.stderr).toBe(true);
    const msg = thrown(() => gitOk(r.root, ["checkout", "nope"], gitEnv(r.root)));
    expect(msg.startsWith("git checkout failed (exit 1): error: pathspec 'nope' did not match"), "gitOk message: " + msg).toBe(true);
    expect(msg.includes("\n"), "only git's first stderr line: " + JSON.stringify(msg)).toBe(false);
  } finally {
    r.rm();
  }
});

test("§2.2: gitOk returns stdout untrimmed on exit 0", () => {
  const r = tmpRepo();
  try {
    expect(gitOk(r.root, ["rev-parse", "--abbrev-ref", "HEAD"], gitEnv(r.root)), "gitOk stdout").toBe("main\n");
  } finally {
    r.rm();
  }
});

test("§2.2: gitOk keeps only the first line of a multi-line stderr and names args[0]", () => {
  const r = tmpRepo();
  try {
    const args = ["-c", "alias.two=!echo one >&2; echo two >&2; exit 3", "two"];
    const got = runGit(r.root, args, gitEnv(r.root));
    expect(`${got.code} ${JSON.stringify(got.stderr)}`, "runGit").toBe('3 "one\\ntwo\\n"');
    expect(thrown(() => gitOk(r.root, args, gitEnv(r.root))), "gitOk message").toBe("git -c failed (exit 3): one");
  } finally {
    r.rm();
  }
});

test("§2.2: a spawn failure is code null and 'git could not start: ', never a throw; gitOk names exit null", () => {
  const r = tmpRepo();
  try {
    const env = { ...gitEnv(r.root), PATH: "/nonexistent-morph-path" };
    let got: GitResult = { code: -1, stdout: "", stderr: "" };
    expect(thrown(() => { got = runGit(r.root, ["status"], env); }), "runGit must not throw").toBe("did not throw");
    expect(`${got.code} [${got.stdout}]`, "code null, empty stdout").toBe("null []");
    expect(got.stderr.startsWith("git could not start: "), "stderr: " + got.stderr).toBe(true);
    const msg = thrown(() => gitOk(r.root, ["status"], env));
    expect(msg.startsWith("git status failed (exit null): git could not start: "), "gitOk message: " + msg).toBe(true);
  } finally {
    r.rm();
  }
});

test("§2.2: the types", () => {
  expectTypeOf(runGit).returns.toEqualTypeOf<GitResult>();
  expectTypeOf(gitOk).returns.toEqualTypeOf<string>();
  expectTypeOf<GitResult>().toEqualTypeOf<{ code: number | null; stdout: string; stderr: string }>();
  expectTypeOf(runGit).parameters.toEqualTypeOf<[string, string[], Record<string, string>]>();
});
