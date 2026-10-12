import fs from "node:fs";
import { test, expect } from "vitest";
import { runCommand } from "../../src/cli/runCommand.js";
import type { CliDeps, RunArgs, RunDocument } from "../../src/cli/types.js";
import { fixtureJson, tmpRepo, tmpRoot } from "../helpers.js";
import type { TmpRepo, TmpRoot } from "../helpers.js";

interface SuiteNetFixture {
  vitest: Record<string, string>;
  repo: Record<string, string>;
}

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

const RELATED_ACCEPTANCE =
  "test -f out/a.ts\necho '== full'; node_modules/.bin/vitest related --run out/a.ts";

test("Run Command example 13: a deck that ran only the related tests runs the whole suite once and exits 1", async () => {
  const net = fixtureJson("cli/suiteNet.json") as SuiteNetFixture;
  const s = setupRun(
    [
      card("a", "out/a.ts", { acceptance: RELATED_ACCEPTANCE }),
      card("b", "out/b.ts", { acceptance: "test -f out/b.ts", dependsOn: ["a"] }),
    ],
    ["a", "b"]
  );
  try {
    fs.chmodSync(
      s.r.write("node_modules/.bin/vitest", net.vitest.runRed as string),
      0o755
    );
    s.r.write("tests/a.test.ts", net.repo["tests/a.test.ts"] as string);
    s.r.git(["add", "node_modules/.bin/vitest", "tests/a.test.ts"]);
    s.r.git(["commit", "-q", "-m", "net"]);
    const got = await runCommand(s.r.root, makeRunArgs(s.side, { runId: "r13" }), s.deps);
    expect(got.code).toBe(1);
    const doc = got.document as RunDocument;
    expect(Object.keys(doc as unknown as Record<string, unknown>)).toStrictEqual([
      "runId",
      "branch",
      "base",
      "report",
      "archive",
      "suite",
    ]);
    expect(doc.report.outcomes.map((o) => o.customId + ":" + o.status)).toStrictEqual([
      "a:written",
      "b:written",
    ]);
    expect(doc.archive.ok).toBe(true);
    expect(doc.suite).toStrictEqual({
      command: "node_modules/.bin/vitest run --reporter=dot",
      ok: false,
      failing: ["tests/a.test.ts > A example 1: red"],
      cards: ["a"],
      log: " FAIL  tests/a.test.ts > A example 1: red\n",
    });
  } finally {
    s.r.rm();
    s.side.rm();
  }
});

test("Run Command example 14: a green whole suite keeps the run at exit 0", async () => {
  const net = fixtureJson("cli/suiteNet.json") as SuiteNetFixture;
  const s = setupRun(
    [
      card("a", "out/a.ts", { acceptance: RELATED_ACCEPTANCE }),
      card("b", "out/b.ts", { acceptance: "test -f out/b.ts", dependsOn: ["a"] }),
    ],
    ["a", "b"]
  );
  try {
    fs.chmodSync(
      s.r.write("node_modules/.bin/vitest", net.vitest.runGreen as string),
      0o755
    );
    s.r.write("tests/a.test.ts", net.repo["tests/a.test.ts"] as string);
    s.r.git(["add", "node_modules/.bin/vitest", "tests/a.test.ts"]);
    s.r.git(["commit", "-q", "-m", "net"]);
    const got = await runCommand(s.r.root, makeRunArgs(s.side, { runId: "r14" }), s.deps);
    expect(got.code).toBe(0);
    const doc = got.document as RunDocument;
    expect(Object.keys(doc as unknown as Record<string, unknown>)).toStrictEqual([
      "runId",
      "branch",
      "base",
      "report",
      "archive",
      "suite",
    ]);
    expect(doc.report.outcomes.map((o) => o.customId + ":" + o.status)).toStrictEqual([
      "a:written",
      "b:written",
    ]);
    expect(doc.suite).toStrictEqual({
      command: "node_modules/.bin/vitest run --reporter=dot",
      ok: true,
      failing: [],
      cards: [],
      log: "",
    });
  } finally {
    s.r.rm();
    s.side.rm();
  }
});

test("Run Command example 15: no card runs only the related tests, so the document has no suite key", async () => {
  const s = setupRun(
    [
      card("a", "out/a.ts", { acceptance: "test -f out/a.ts" }),
      card("b", "out/b.ts", { acceptance: "test -f out/b.ts", dependsOn: ["a"] }),
    ],
    ["a", "b"]
  );
  try {
    const got = await runCommand(s.r.root, makeRunArgs(s.side, { runId: "r15" }), s.deps);
    expect(got.code).toBe(0);
    const doc = got.document as RunDocument;
    expect(Object.keys(doc as unknown as Record<string, unknown>)).toStrictEqual([
      "runId",
      "branch",
      "base",
      "report",
      "archive",
    ]);
    expect(doc.suite).toBeUndefined();
    expect(doc.report.outcomes.map((o) => o.customId + ":" + o.status)).toStrictEqual([
      "a:written",
      "b:written",
    ]);
    expect(doc.archive.ok).toBe(true);
  } finally {
    s.r.rm();
    s.side.rm();
  }
});
