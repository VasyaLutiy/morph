import { expect, test } from "vitest";
import { openRunBranch } from "../../src/git/branch.js";
import { tmpRepo, tmpRoot } from "../helpers.js";

test("Open Run Branch example 1: fresh repo opens morph/r1 at HEAD", () => {
  const r = tmpRepo();
  try {
    const head = r.git(["rev-parse", "HEAD"]);
    const got = openRunBranch(r.root, "r1", {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    });
    expect(got).toStrictEqual({ ok: true, branch: "morph/r1", base: head });
    expect(r.git(["rev-parse", "--abbrev-ref", "HEAD"])).toBe("morph/r1");
  } finally {
    r.rm();
  }
});

test("Open Run Branch example 2: untracked files under .morph/ do not make the tree dirty", () => {
  const r = tmpRepo();
  try {
    r.write(".morph/deck.json", "{}");
    r.write(".morph/runs/x/report.json", "{}");
    const head = r.git(["rev-parse", "HEAD"]);
    const got = openRunBranch(r.root, "r2", {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    });
    expect(got).toStrictEqual({ ok: true, branch: "morph/r2", base: head });
  } finally {
    r.rm();
  }
});

test("Open Run Branch example 3: modified tracked file and untracked file refuse the open", () => {
  const r = tmpRepo();
  try {
    r.write("README.md", "one");
    r.git(["add", "README.md"]);
    r.git(["commit", "-q", "-m", "readme"]);
    r.write("README.md", "two");
    r.write("src/a.ts", "export {};\n");
    const got = openRunBranch(r.root, "r3", {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    });
    expect(got).toStrictEqual({
      ok: false,
      error: "dirty tree outside .morph/: README.md, src/a.ts",
    });
    expect(r.git(["rev-parse", "--abbrev-ref", "HEAD"])).toBe("main");
    expect(r.git(["for-each-ref", "refs/heads/morph/r3"])).toBe("");
  } finally {
    r.rm();
  }
});

test("Open Run Branch example 4: existing branch refuses, then an invalid runId refuses", () => {
  const r = tmpRepo();
  try {
    r.git(["branch", "morph/r4"]);
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const got = openRunBranch(r.root, "r4", env);
    expect(got).toStrictEqual({ ok: false, error: "branch morph/r4 already exists" });
    expect(r.git(["rev-parse", "--abbrev-ref", "HEAD"])).toBe("main");
    const again = openRunBranch(r.root, "a b", env);
    expect(again).toStrictEqual({ ok: false, error: "invalid runId: a b" });
  } finally {
    r.rm();
  }
});

test("Open Run Branch own: an invalid runId answers without a git call, even outside a repo", () => {
  const t = tmpRoot("morph-norepo-");
  try {
    const got = openRunBranch(t.root, "bad id", {
      PATH: process.env.PATH ?? "",
      HOME: t.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    });
    expect(got).toStrictEqual({ ok: false, error: "invalid runId: bad id" });
  } finally {
    t.rm();
  }
});

test("Open Run Branch own: a valid runId outside a repo throws git status's error", () => {
  const t = tmpRoot("morph-norepo-");
  try {
    expect(() =>
      openRunBranch(t.root, "r9", {
        PATH: process.env.PATH ?? "",
        HOME: t.root,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_AUTHOR_NAME: "Ada",
        GIT_AUTHOR_EMAIL: "ada@example.invalid",
        GIT_COMMITTER_NAME: "Ada",
        GIT_COMMITTER_EMAIL: "ada@example.invalid",
      }),
    ).toThrowError(/^git status failed \(exit 128\): /);
  } finally {
    t.rm();
  }
});

test("Open Run Branch own: a staged rename outside .morph/ names the destination as dirty", () => {
  const r = tmpRepo();
  try {
    r.write("a.ts", "export {};\n");
    r.git(["add", "a.ts"]);
    r.git(["commit", "-q", "-m", "a"]);
    r.git(["mv", "a.ts", "b.ts"]);
    const got = openRunBranch(r.root, "r5", {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    });
    expect(got).toStrictEqual({ ok: false, error: "dirty tree outside .morph/: b.ts" });
  } finally {
    r.rm();
  }
});

test("Open Run Branch own: a staged rename into .morph/ is not dirty", () => {
  const r = tmpRepo();
  try {
    r.write(".morph/.keep", "");
    r.write("src/x.ts", "export {};\n");
    r.git(["add", "src/x.ts"]);
    r.git(["commit", "-q", "-m", "x"]);
    r.git(["mv", "src/x.ts", ".morph/x.ts"]);
    const head = r.git(["rev-parse", "HEAD"]);
    const got = openRunBranch(r.root, "r6", {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    });
    expect(got).toStrictEqual({ ok: true, branch: "morph/r6", base: head });
  } finally {
    r.rm();
  }
});

test("Open Run Branch own: a modified tracked file under .morph/ is not dirty", () => {
  const r = tmpRepo();
  try {
    r.write(".morph/deck.json", "[]");
    r.git(["add", ".morph/deck.json"]);
    r.git(["commit", "-q", "-m", "deck"]);
    r.write(".morph/deck.json", "[1]");
    const head = r.git(["rev-parse", "HEAD"]);
    const got = openRunBranch(r.root, "r7", {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    });
    expect(got).toStrictEqual({ ok: true, branch: "morph/r7", base: head });
  } finally {
    r.rm();
  }
});

test("Open Run Branch own: the base is 40 lowercase hex chars equal to HEAD", () => {
  const r = tmpRepo();
  try {
    const got = openRunBranch(r.root, "r8", {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    });
    const base = got.ok ? got.base : "refused";
    expect(base).toMatch(/^[0-9a-f]{40}$/);
    expect(base).toBe(r.git(["rev-parse", "HEAD"]));
  } finally {
    r.rm();
  }
});

test("Open Run Branch own: dirty paths sort in code-unit order", () => {
  const r = tmpRepo();
  try {
    r.write("B.ts", "export {};\n");
    r.write("a.ts", "export {};\n");
    const got = openRunBranch(r.root, "r9", {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    });
    expect(got).toStrictEqual({ ok: false, error: "dirty tree outside .morph/: B.ts, a.ts" });
  } finally {
    r.rm();
  }
});

test("Open Run Branch own: a staged deletion of a tracked file is dirty", () => {
  const r = tmpRepo();
  try {
    r.write("del.ts", "export {};\n");
    r.git(["add", "del.ts"]);
    r.git(["commit", "-q", "-m", "del"]);
    r.git(["rm", "-q", "del.ts"]);
    const got = openRunBranch(r.root, "r10", {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    });
    expect(got).toStrictEqual({ ok: false, error: "dirty tree outside .morph/: del.ts" });
  } finally {
    r.rm();
  }
});
