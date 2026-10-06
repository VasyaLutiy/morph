import { test, expect } from "vitest";
import { runCommand, mintRunId } from "../../src/cli/runCommand.js";
import type { CliDeps, ErrorDocument, RunArgs, RunDocument } from "../../src/cli/types.js";
import { tmpRepo, tmpRoot } from "../helpers.js";
import type { TmpRepo, TmpRoot } from "../helpers.js";

interface RunSetup {
  r: TmpRepo;
  side: TmpRoot;
  deps: CliDeps;
}

function card(
  customId: string,
  target: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return { customId, intent: "generate", targets: [target], instruction: "x", ...extra };
}

function setupRun(deck: unknown[], answers: readonly string[]): RunSetup {
  const r = tmpRepo();
  const side = tmpRoot();
  for (const id of answers) {
    side.write("answers/" + id + ".md", "```ts\nexport const " + id + " = 1;\n```\n");
  }
  side.write("deck.json", JSON.stringify(deck));
  const deps: CliDeps = {
    env: {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
      MORPH_PROCESSOR_s_TYPE: "stub",
      MORPH_PROCESSOR_s_ANSWERS_DIR: side.path("answers"),
    },
    now: () => 1791310149000,
    cwd: r.root,
    transport: null,
  };
  return { r, side, deps };
}

function makeRunArgs(side: TmpRoot, overrides: Partial<RunArgs> = {}): RunArgs {
  const base: RunArgs = {
    name: "run",
    root: ".",
    pretty: false,
    deck: side.path("deck.json"),
    processor: "s",
    runId: "r1",
    deadlineSeconds: 2400,
    maxCards: null,
    maxRetryBatches: 0,
  };
  return { ...base, ...overrides };
}

test("Run Command example 1: two cards run, commit and archive on morph/r1", async () => {
  const s = setupRun(
    [
      card("a", "out/a.ts", { acceptance: "test -f out/a.ts" }),
      card("b", "out/b.ts", { acceptance: "test -f out/b.ts", dependsOn: ["a"] }),
    ],
    ["a", "b"]
  );
  try {
    const base = s.r.git(["rev-parse", "HEAD"]);
    const got = await runCommand(s.r.root, makeRunArgs(s.side), s.deps);
    expect(got.code).toBe(0);
    const doc = got.document as RunDocument;
    expect(doc.runId).toBe("r1");
    expect(doc.branch).toBe("morph/r1");
    expect(doc.base).toBe(base);
    expect(doc.report.outcomes.map((o) => o.customId + ":" + o.status)).toStrictEqual([
      "a:written",
      "b:written",
    ]);
    expect(doc.report.generations).toBe(2);
    expect(doc.report.processor).toBe("s");
    expect(doc.report.usageTotals.requests).toBe(2);
    expect(doc.archive.ok).toBe(true);
    if (doc.archive.ok) {
      expect(doc.archive.dir).toBe(".morph/runs/r1");
      expect(doc.archive.commit).toBe(s.r.git(["rev-parse", "HEAD"]));
    }
    const subjects = s.r.git(["log", "--format=%s", base + "..HEAD"]).split("\n");
    expect(subjects).toStrictEqual([
      "morph run r1: deck and report",
      "morph b: out/b.ts",
      "morph a: out/a.ts",
    ]);
    expect(s.r.git(["symbolic-ref", "--short", "HEAD"])).toBe("morph/r1");
    expect(s.r.git(["status", "--porcelain"])).toBe("");
  } finally {
    s.r.rm();
    s.side.rm();
  }
});

test("Run Command example 2: a failed acceptance exits 1 and trailers the archive", async () => {
  const s = setupRun([card("a", "out/a.ts", { acceptance: "exit 1" })], ["a"]);
  try {
    const got = await runCommand(s.r.root, makeRunArgs(s.side), s.deps);
    expect(got.code).toBe(1);
    const doc = got.document as RunDocument;
    expect(doc.report.outcomes.length).toBe(1);
    expect(doc.report.outcomes[0].customId).toBe("a");
    expect(doc.report.outcomes[0].status).toBe("failed");
    expect(doc.report.outcomes[0].reason).toBe("acceptance failed");
    expect(doc.archive.ok).toBe(true);
    if (doc.archive.ok) {
      expect(doc.archive.dir).toBe(".morph/runs/r1");
    }
    const body = s.r.git(["show", "-s", "--format=%B", "HEAD"]);
    expect(body.includes("Morph-Failed: 1")).toBe(true);
    expect(s.r.exists("out/a.ts")).toBe(false);
  } finally {
    s.r.rm();
    s.side.rm();
  }
});

test("Run Command example 3: an unconfigured processor is a usage error before any git", async () => {
  const s = setupRun([card("a", "out/a.ts")], ["a"]);
  try {
    const nope = await runCommand(
      s.r.root,
      makeRunArgs(s.side, { processor: "nope" }),
      s.deps
    );
    expect(nope).toStrictEqual({
      code: 4,
      document: {
        error: { code: 4, kind: "UsageError", message: "processor nope is not configured" },
      },
    });
    const badEnv = { ...s.deps.env, MORPH_PROCESSOR_bad_TYPE: "x" };
    const bad = await runCommand(
      s.r.root,
      makeRunArgs(s.side, { processor: "bad" }),
      { ...s.deps, env: badEnv }
    );
    expect(bad).toStrictEqual({
      code: 4,
      document: {
        error: {
          code: 4,
          kind: "UsageError",
          message:
            "processor bad is not configured: MORPH_PROCESSOR_bad_TYPE must be one of openrouter, stub (got 'x')",
        },
      },
    });
    expect(s.r.git(["for-each-ref", "refs/heads/morph/*"])).toBe("");
  } finally {
    s.r.rm();
    s.side.rm();
  }
});

test("Run Command example 4: a dirty tree refuses before the branch is opened", async () => {
  const s = setupRun([card("a", "out/a.ts")], ["a"]);
  try {
    s.r.write("notes.txt", "note\n");
    const got = await runCommand(s.r.root, makeRunArgs(s.side), s.deps);
    expect(got).toStrictEqual({
      code: 2,
      document: {
        error: {
          code: 2,
          kind: "RefusalError",
          message: "dirty tree outside .morph/: notes.txt",
        },
      },
    });
    expect(s.r.git(["symbolic-ref", "--short", "HEAD"])).toBe("main");
    expect(s.r.exists(".morph/runs/r1")).toBe(false);
  } finally {
    s.r.rm();
    s.side.rm();
  }
});

test("Run Command example 5: a write-write hazard refuses the run", async () => {
  const s = setupRun([card("a", "out/x.ts"), card("b", "out/x.ts")], ["a", "b"]);
  try {
    const got = await runCommand(s.r.root, makeRunArgs(s.side), s.deps);
    expect(got).toStrictEqual({
      code: 2,
      document: {
        error: {
          code: 2,
          kind: "RefusalError",
          message: "deck has 1 hazard error(s): write-write a,b out/x.ts",
        },
      },
    });
    expect(s.r.git(["for-each-ref", "refs/heads/morph/*"])).toBe("");
  } finally {
    s.r.rm();
    s.side.rm();
  }
});

test("Run Command example 6: a null runId is minted from the clock", async () => {
  expect(mintRunId(1791310149000)).toBe("20261006-180909");
  const s = setupRun([card("a", "out/a.ts", { acceptance: "test -f out/a.ts" })], ["a"]);
  try {
    const got = await runCommand(s.r.root, makeRunArgs(s.side, { runId: null }), s.deps);
    expect(got.code).toBe(0);
    const doc = got.document as RunDocument;
    expect(doc.runId).toBe("20261006-180909");
    expect(doc.report.runId).toBe("20261006-180909");
    expect(doc.branch).toBe("morph/20261006-180909");
    expect(s.r.exists(".morph/runs/20261006-180909/report.json")).toBe(true);
  } finally {
    s.r.rm();
    s.side.rm();
  }
});

test("runCommand own 1: a missing deck file is a usage error with the path as given", async () => {
  const s = setupRun([card("a", "out/a.ts")], ["a"]);
  try {
    const got = await runCommand(
      s.r.root,
      makeRunArgs(s.side, { deck: "nope.json" }),
      s.deps
    );
    expect(got).toStrictEqual({
      code: 4,
      document: {
        error: { code: 4, kind: "UsageError", message: "deck file not found: nope.json" },
      },
    });
  } finally {
    s.r.rm();
    s.side.rm();
  }
});

test("runCommand own 2: a deck that is not JSON is a deck error", async () => {
  const s = setupRun([card("a", "out/a.ts")], ["a"]);
  try {
    s.side.write("bad.json", "{");
    const got = await runCommand(
      s.r.root,
      makeRunArgs(s.side, { deck: s.side.path("bad.json") }),
      s.deps
    );
    expect(got.code).toBe(2);
    const doc = got.document as ErrorDocument;
    expect(doc.error.code).toBe(2);
    expect(doc.error.kind).toBe("DeckError");
    expect(doc.error.message.startsWith("invalid deck: deck: deck is not valid JSON")).toBe(
      true
    );
  } finally {
    s.r.rm();
    s.side.rm();
  }
});

test("runCommand own 3: a dependsOn cycle is a deck error", async () => {
  const s = setupRun(
    [card("a", "out/a.ts", { dependsOn: ["b"] }), card("b", "out/b.ts", { dependsOn: ["a"] })],
    []
  );
  try {
    const got = await runCommand(s.r.root, makeRunArgs(s.side), s.deps);
    expect(got).toStrictEqual({
      code: 2,
      document: {
        error: {
          code: 2,
          kind: "DeckError",
          message: "invalid deck: dependsOn: dependsOn cycle a -> b -> a",
        },
      },
    });
  } finally {
    s.r.rm();
    s.side.rm();
  }
});
