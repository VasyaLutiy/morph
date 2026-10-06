import { expect, test } from "vitest";
import { runGit, gitOk } from "../../src/git/run.js";
import { tmpRepo, tmpRoot } from "../helpers.js";

test("Run Git example 1: abbrev-ref of a fresh repo is main", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const got = runGit(r.root, ["rev-parse", "--abbrev-ref", "HEAD"], env);
    expect(got).toStrictEqual({ code: 0, stdout: "main\n", stderr: "" });
  } finally {
    r.rm();
  }
});

test("Run Git example 2: LC_ALL and GIT_TERMINAL_PROMPT forced, nothing of the parent leaks", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
      FOO: "bar",
      LC_ALL: "de_DE.UTF-8",
    };
    const got = runGit(
      r.root,
      ["-c", 'alias.envs=!echo "$LC_ALL $GIT_TERMINAL_PROMPT $FOO ${USER-unset}"', "envs"],
      env,
    );
    expect(got).toStrictEqual({ code: 0, stdout: "C 0 bar unset\n", stderr: "" });
  } finally {
    r.rm();
  }
});

test("Run Git example 3: a failing checkout, its GitResult and gitOk's message", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const got = runGit(r.root, ["checkout", "nope"], env);
    expect(got.code === 1).toBe(true);
    expect(got.stdout).toBe("");
    expect(got.stderr.startsWith("error: pathspec 'nope' did not match")).toBe(true);
    let msg = "";
    try {
      gitOk(r.root, ["checkout", "nope"], env);
    } catch (e: unknown) {
      msg = e instanceof Error ? e.message : String(e);
    }
    expect(msg.startsWith("git checkout failed (exit 1): error: pathspec 'nope' did not match")).toBe(true);
  } finally {
    r.rm();
  }
});

test("gitOk returns stdout untouched: rev-parse keeps its trailing newline", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const out = gitOk(r.root, ["rev-parse", "HEAD"], env);
    expect(out).toBe(r.git(["rev-parse", "HEAD"]) + "\n");
  } finally {
    r.rm();
  }
});

test("gitOk returns stdout untouched for multi-line output", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    r.git(["commit", "--allow-empty", "-q", "-m", "second"]);
    const out = gitOk(r.root, ["log", "--format=%s"], env);
    expect(out).toBe("second\ninit\n");
  } finally {
    r.rm();
  }
});

test("a quiet success gives empty stdout through gitOk", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    expect(gitOk(r.root, ["status", "--porcelain", "--untracked-files=all"], env)).toBe("");
  } finally {
    r.rm();
  }
});

test("gitOk uses only the first line of a multi-line stderr", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    let msg = "";
    try {
      gitOk(r.root, ["checkout", "nope1", "nope2"], env);
    } catch (e: unknown) {
      msg = e instanceof Error ? e.message : String(e);
    }
    expect(msg.startsWith("git checkout failed (exit 1): error: pathspec 'nope1' did not match")).toBe(true);
    expect(msg.includes("nope2")).toBe(false);
  } finally {
    r.rm();
  }
});

test("runGit never throws: a non-repo is a plain GitResult, gitOk throws", () => {
  const r = tmpRoot("morph-nonrepo-");
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const got = runGit(r.root, ["status"], env);
    expect(got.code === 128).toBe(true);
    expect(got.stderr.startsWith("fatal: not a git repository")).toBe(true);
    let msg = "";
    try {
      gitOk(r.root, ["status"], env);
    } catch (e: unknown) {
      msg = e instanceof Error ? e.message : String(e);
    }
    expect(msg.startsWith("git status failed (exit 128): fatal: not a git repository")).toBe(true);
  } finally {
    r.rm();
  }
});

test("a spawn failure gives code null and git could not start", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const got = runGit(r.path("missing-dir"), ["status"], env);
    expect(got.code === null).toBe(true);
    expect(got.stdout).toBe("");
    expect(got.stderr.startsWith("git could not start: ")).toBe(true);
    let msg = "";
    try {
      gitOk(r.path("missing-dir"), ["status"], env);
    } catch (e: unknown) {
      msg = e instanceof Error ? e.message : String(e);
    }
    expect(msg.startsWith("git status failed (exit null): git could not start: ")).toBe(true);
  } finally {
    r.rm();
  }
});

test("the env is used whole: a commit made through it carries Ada as author and committer", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    r.write("f.txt", "x\n");
    const added = runGit(r.root, ["add", "--", "f.txt"], env);
    expect(added).toStrictEqual({ code: 0, stdout: "", stderr: "" });
    const committed = runGit(r.root, ["commit", "-q", "-m", "c1"], env);
    expect(committed).toStrictEqual({ code: 0, stdout: "", stderr: "" });
    expect(r.git(["log", "-1", "--format=%an <%ae> %cn"])).toBe("Ada <ada@example.invalid> Ada");
  } finally {
    r.rm();
  }
});

test("runGit passes extra env keys whole: a git -c value rides along", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
      FOO: "bar",
    };
    const got = runGit(
      r.root,
      ["-c", 'alias.e=!echo "$FOO"', "e"],
      env,
    );
    expect(got).toStrictEqual({ code: 0, stdout: "bar\n", stderr: "" });
  } finally {
    r.rm();
  }
});

test("runGit reports an untracked file with the full porcelain line", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    r.write("new.txt", "x\n");
    const got = runGit(r.root, ["status", "--porcelain", "--untracked-files=all"], env);
    expect(got).toStrictEqual({ code: 0, stdout: "?? new.txt\n", stderr: "" });
  } finally {
    r.rm();
  }
});
