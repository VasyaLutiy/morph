// P37 probe for run-command (src/cli/runCommand.ts, src/cli/types.ts) — issue #49: after the archive, Suite Net runs
// once; its red is exit 1 and the document's last key suite. Record cli/Run Command examples 13-15 (examples.json).
import fs from "node:fs";
import { test, expect } from "vitest";
import { runCommand } from "../../src/cli/runCommand.js";
import type { CliDeps, RunArgs, RunDocument } from "../../src/cli/types.js";
import { fixtureJson, tmpRepo, tmpRoot } from "../../tests/helpers.js";
import type { TmpRepo, TmpRoot } from "../../tests/helpers.js";

interface SuiteFixture { vitest: Record<string, string>; repo: Record<string, string> }
const fx = (): SuiteFixture => fixtureJson("cli/suiteNet.json") as SuiteFixture;
const SUITE = "node_modules/.bin/vitest run --reporter=dot";

function card(customId: string, target: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { customId, intent: "generate", targets: [target], instruction: "x", ...extra };
}

function setup(deck: unknown[], vitest: string | null): { r: TmpRepo; side: TmpRoot; deps: CliDeps } {
  const r = tmpRepo();
  const side = tmpRoot();
  for (const id of ["a", "b"]) side.write("answers/" + id + ".md", "```ts\nexport const " + id + " = 1;\n```\n");
  side.write("deck.json", JSON.stringify(deck));
  if (vitest !== null) {
    fs.chmodSync(r.write("node_modules/.bin/vitest", fx().vitest[vitest]), 0o755);
    r.write("tests/a.test.ts", fx().repo["tests/a.test.ts"]);
    r.git(["add", "node_modules/.bin/vitest", "tests/a.test.ts"]);
    r.git(["commit", "-q", "-m", "net"]);
  }
  const deps: CliDeps = {
    env: {
      PATH: process.env.PATH ?? "", HOME: r.root, GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@example.invalid", GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL: "ada@example.invalid",
      MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: side.path("answers"),
    },
    now: () => 1791310149000, cwd: r.root, transport: null,
  };
  return { r, side, deps };
}
const args = (side: TmpRoot, runId: string): RunArgs => ({
  name: "run", root: ".", pretty: false, deck: side.path("deck.json"), processor: "s", runId,
  deadlineSeconds: 2400, maxCards: null, maxRetryBatches: 0,
});
const netDeck = (): unknown[] => [
  card("a", "out/a.ts", { acceptance: "test -f out/a.ts\necho '== full'; node_modules/.bin/vitest related --run out/a.ts" }),
  card("b", "out/b.ts", { acceptance: "test -f out/b.ts", dependsOn: ["a"] }),
];

test("Run Command example 13: a red net is exit 1 and the document's last key suite; the commits stay", async () => {
  const s = setup(netDeck(), "runRed");
  try {
    const got = await runCommand(s.r.root, args(s.side, "r13"), s.deps);
    expect(got.code).toBe(1);
    const doc = got.document as RunDocument & { suite?: unknown };
    expect(doc.report.outcomes.map((o) => o.customId + ":" + o.status)).toStrictEqual(["a:written", "b:written"]);
    expect(doc.archive.ok).toBe(true);
    expect(Object.keys(doc)).toStrictEqual(["runId", "branch", "base", "report", "archive", "suite"]);
    expect(doc.suite).toStrictEqual({
      command: SUITE, ok: false, failing: ["tests/a.test.ts > A example 1: red"], cards: ["a"],
      log: " FAIL  tests/a.test.ts > A example 1: red\n",
    });
  } finally {
    s.r.rm();
    s.side.rm();
  }
});

test("Run Command example 14: a green net keeps exit 0", async () => {
  const s = setup(netDeck(), "runGreen");
  try {
    const got = await runCommand(s.r.root, args(s.side, "r14"), s.deps);
    expect(got.code).toBe(0);
    const doc = got.document as RunDocument & { suite?: unknown };
    expect(doc.report.outcomes.map((o) => o.customId + ":" + o.status)).toStrictEqual(["a:written", "b:written"]);
    expect(Object.keys(doc).at(-1)).toBe("suite");
    expect(doc.suite).toStrictEqual({ command: SUITE, ok: true, failing: [], cards: [], log: "" });
  } finally {
    s.r.rm();
    s.side.rm();
  }
});

test("Run Command example 15: no acceptance holds the related mark, no suite key", async () => {
  const s = setup([
    card("a", "out/a.ts", { acceptance: "test -f out/a.ts" }),
    card("b", "out/b.ts", { acceptance: "test -f out/b.ts", dependsOn: ["a"] }),
  ], null);
  try {
    const got = await runCommand(s.r.root, args(s.side, "r15"), s.deps);
    expect(got.code).toBe(0);
    expect(Object.keys(got.document as object)).toStrictEqual(["runId", "branch", "base", "report", "archive"]);
  } finally {
    s.r.rm();
    s.side.rm();
  }
});
