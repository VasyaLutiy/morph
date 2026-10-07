// P11c probe for run-command by docs/TASK_P11c_runner.md §2.2 (issue #5 findings 1 and 9) — a fault in the run (the
// report carries `fault`) archives the partial report and returns code 3 with the Run Document; a deck of no cards is
// refused before any git call. Record Run Command examples 10-11, then the §2.2 rows.
import { test, expect } from "vitest";
import fs from "node:fs";
import { runCommand } from "../../src/cli/runCommand.js";
import type { CliDeps, CommandResult, RunArgs, RunDocument } from "../../src/cli/types.js";
import { tmpRepo, tmpRoot } from "../../tests/helpers.js";
import type { TmpRepo, TmpRoot } from "../../tests/helpers.js";

function gitEnv(home: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "", HOME: home, GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@example.invalid",
    GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL: "ada@example.invalid",
  };
}
const ANSWER = "```ts\nexport const a = 1;\n```\n";
const args = (deck: string, runId: string): RunArgs => ({
  name: "run", root: ".", pretty: false, deck, processor: "s", runId, deadlineSeconds: 2400, maxCards: null, maxRetryBatches: 1 });
const errorOf = (got: CommandResult): string => JSON.stringify(got).slice(0, 600);
function setup(cards: unknown[]): { r: TmpRepo; side: TmpRoot; deps: CliDeps; deck: string } {
  const r = tmpRepo();
  const side = tmpRoot();
  for (const name of ["a.md", "b.md"]) side.write(`answers/${name}`, ANSWER);
  const deck = side.write("deck.json", JSON.stringify(cards));
  const deps: CliDeps = { env: { ...gitEnv(r.root), MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: side.path("answers") },
    now: () => 1791310149000, cwd: r.root, transport: null };
  return { r, side, deps, deck };
}
const AB = [
  { customId: "a", intent: "generate", targets: ["out/a.ts"], instruction: "x", acceptance: "test -f out/a.ts" },
  { customId: "b", intent: "generate", targets: ["out/b.ts"], instruction: "x", acceptance: "test -f out/b.ts", dependsOn: ["a"] }];
const HOOK = "#!/bin/sh\nif grep -q '^morph a:' \"$1\"; then echo 'card commits refused' >&2; exit 1; fi\nexit 0\n";

test("Run Command example 10: a fault in the run archives the partial report and returns 3", async () => {
  const { r, side, deps, deck } = setup(AB);
  try {
    fs.writeFileSync(r.path(".git/hooks/commit-msg"), HOOK, { mode: 0o755 });
    const base = r.git(["rev-parse", "HEAD"]);
    const got = await runCommand(r.root, args(deck, "r10"), deps);
    expect(got.code, errorOf(got)).toBe(3);
    const doc = got.document as RunDocument;
    expect(doc.report.fault, "fault").toBe("git commit failed (exit 1): card commits refused");
    expect(doc.report.outcomes.map((o) => `${o.customId} ${o.status} ${o.reason}`).join("; "), "outcomes").toBe("a skipped fault; b skipped fault");
    expect(JSON.stringify(doc.archive), "archive").toBe(JSON.stringify({ ok: true, dir: ".morph/runs/r10", commit: r.git(["rev-parse", "HEAD"]) }));
    expect(r.git(["log", "--format=%s", base + "..HEAD"]), "subjects").toBe("morph run r10: deck and report");
    expect(r.git(["log", "-1", "--format=%(trailers:key=Morph-Skipped,valueonly)"]), "trailer").toBe("2");
    const archived = JSON.parse(r.read(".morph/runs/r10/report.json")) as { fault?: string };
    expect(archived.fault, "archived fault").toBe("git commit failed (exit 1): card commits refused");
    expect(`${doc.runId} ${doc.branch} ${r.git(["rev-parse", "--abbrev-ref", "HEAD"])}`, "branch").toBe("r10 morph/r10 morph/r10");
  } finally {
    r.rm();
    side.rm();
  }
});

test("Run Command example 11: a deck of no cards is refused before any git call", async () => {
  const { r, side, deps, deck } = setup([]);
  try {
    const got = await runCommand(r.root, args(deck, "r11"), deps);
    expect(got, "refusal").toStrictEqual({ code: 2, document: { error: { code: 2, kind: "RefusalError", message: "deck has no cards" } } });
    expect(`${r.git(["branch", "--list", "morph/*"])}|${r.exists(".morph")}|${r.git(["rev-parse", "--abbrev-ref", "HEAD"])}`, "no branch, no archive").toBe("|false|main");
  } finally {
    r.rm();
    side.rm();
  }
});

test("§2.2 rows: no fault → the old code; the order of the refusals; the empty deck after the processor", async () => {
  const { r, side, deps, deck } = setup(AB);
  try {
    const got = await runCommand(r.root, args(deck, "r12"), deps);
    expect(got.code, errorOf(got)).toBe(0);
    expect("fault" in (got.document as RunDocument).report, "no fault key").toBe(false);
    const empty = side.write("empty.json", "[]");
    const nope = await runCommand(r.root, { ...args(empty, "r13"), processor: "nope" }, deps);
    expect((nope.document as { error: { message: string } }).error.message, "processor first").toBe("processor nope is not configured");
    const bad = side.write("bad.json", "{}");
    const invalid = await runCommand(r.root, args(bad, "r14"), deps);
    expect(`${invalid.code} ${(invalid.document as { error: { kind: string } }).error.kind}`, "deck file before the empty check").toBe("2 DeckError");
    expect(r.exists(".morph/runs/r13") || r.exists(".morph/runs/r14"), "no archive").toBe(false);
  } finally {
    r.rm();
    side.rm();
  }
});
