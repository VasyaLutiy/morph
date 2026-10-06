// P6 probe for archive-run: archiveRun by docs/TASK_P6_git.md §2.2, one test per record example
// (Component git, Function Archive Run), then the §2.2 rows: every status counted, an invalid id,
// runloop's RunReport accepted as the report, the types.
import { test, expect, expectTypeOf } from "vitest";
import fs from "node:fs";
import { archiveRun } from "../../src/git/archive.js";
import type { ArchiveInput, ArchiveResult, ArchivedReport } from "../../src/git/types.js";
import type { Card, Deck } from "../../src/cards/types.js";
import type { CardOutcome, CardStatus, RunReport } from "../../src/runloop/types.js";
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
const card = (customId: string): Card => ({
  customId, intent: "generate", targets: [`out/${customId}.ts`], contextSlice: [], instruction: "x",
  acceptance: "true", model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: [],
});
const outcome = (customId: string, status: CardStatus): CardOutcome => ({
  customId, status, reason: null, attempts: 1, winningVariant: null, acceptanceLog: "", earlierFailures: [],
  commit: null, diffstat: null,
});
const report = (runId: string, outcomes: CardOutcome[]): RunReport => ({
  runId, completedAt: 5, branch: "morph/" + runId, processor: "stub", generations: 1, outcomes,
  usageTotals: { inputTokens: 0, outputTokens: 0, cost: null, requests: outcomes.length },
});

test("Archive Run example 1: deck.json and report.json written and committed with Morph-Run trailers", () => {
  const r = tmpRepo();
  try {
    r.git(["checkout", "-q", "-b", "morph/r1"]);
    const deck: Deck = { cards: [card("a"), card("b")], externalDependsOn: [] };
    const rep = report("r1", [outcome("a", "written"), outcome("b", "failed")]);
    const got = archiveRun(r.root, { runId: "r1", deck, report: rep }, gitEnv(r.root));
    expect(got, "result").toStrictEqual({ ok: true, dir: ".morph/runs/r1", commit: r.git(["rev-parse", "HEAD"]) });
    expect(r.read(".morph/runs/r1/deck.json"), "deck.json").toBe(JSON.stringify(deck.cards, null, 2) + "\n");
    expect(r.read(".morph/runs/r1/report.json"), "report.json").toBe(JSON.stringify(rep, null, 2) + "\n");
    expect(r.git(["log", "-1", "--format=%B"]), "message").toBe(
      "morph run r1: deck and report\n\nMorph-Run: r1\nMorph-Cards: 2\nMorph-Written: 1\nMorph-Failed: 1\nMorph-Skipped: 0\nMorph-Budget-Exceeded: 0");
    expect(r.git(["show", "--name-only", "--format=", "HEAD"]), "committed paths").toBe(
      ".morph/runs/r1/deck.json\n.morph/runs/r1/report.json");
  } finally {
    r.rm();
  }
});

test("Archive Run example 2: an existing archive is refused, nothing written", () => {
  const r = tmpRepo();
  try {
    const deck: Deck = { cards: [card("a")], externalDependsOn: [] };
    const input: ArchiveInput = { runId: "r1", deck, report: report("r1", [outcome("a", "written")]) };
    expect(archiveRun(r.root, input, gitEnv(r.root)).ok, "first archive").toBe(true);
    const head = r.git(["rev-parse", "HEAD"]);
    const before = r.read(".morph/runs/r1/deck.json");
    const again: ArchiveInput = { runId: "r1", deck: { cards: [card("z")], externalDependsOn: [] }, report: report("r1", []) };
    expect(archiveRun(r.root, again, gitEnv(r.root)), "second").toStrictEqual({
      ok: false,
      error: "archive .morph/runs/r1 already exists",
    });
    expect(r.git(["rev-parse", "HEAD"]), "HEAD unchanged").toBe(head);
    expect(r.read(".morph/runs/r1/deck.json"), "deck.json unchanged").toBe(before);
  } finally {
    r.rm();
  }
});

test("Archive Run example 3: an ignored .morph/ leaves the archive on disk, not committed", () => {
  const r = tmpRepo();
  try {
    r.write(".gitignore", ".morph/\n");
    r.git(["add", ".gitignore"]);
    r.git(["commit", "-q", "-m", "ignore"]);
    const head = r.git(["rev-parse", "HEAD"]);
    const got: ArchiveResult = archiveRun(r.root, { runId: "r2", deck: { cards: [card("a")], externalDependsOn: [] },
      report: report("r2", [outcome("a", "written")]) }, gitEnv(r.root));
    expect(got.ok, "refused").toBe(false);
    const error = got.ok ? "ok" : got.error;
    expect(error.startsWith("archive .morph/runs/r2 written but not committed: git add failed (exit 1): "), "error: " + error).toBe(true);
    expect(`${r.exists(".morph/runs/r2/deck.json")} ${r.exists(".morph/runs/r2/report.json")}`, "files on disk").toBe("true true");
    expect(r.git(["rev-parse", "HEAD"]), "HEAD unchanged").toBe(head);
  } finally {
    r.rm();
  }
});

test("§2.2: every status counted; an invalid runId writes nothing", () => {
  const r = tmpRepo();
  try {
    const deck: Deck = { cards: [card("a"), card("b"), card("c"), card("d"), card("e")], externalDependsOn: ["ext"] };
    const rep = report("n1", [outcome("a", "skipped"), outcome("b", "budget-exceeded"), outcome("c", "budget-exceeded"),
      outcome("d", "written"), outcome("e", "skipped")]);
    expect(archiveRun(r.root, { runId: "n1", deck, report: rep }, gitEnv(r.root)).ok, "archived").toBe(true);
    expect(r.git(["log", "-1", "--format=%(trailers:only,unfold)"]), "trailers").toBe(
      "Morph-Run: n1\nMorph-Cards: 5\nMorph-Written: 1\nMorph-Failed: 0\nMorph-Skipped: 2\nMorph-Budget-Exceeded: 2");
    expect(JSON.parse(r.read(".morph/runs/n1/deck.json")).length, "deck.json is the cards array").toBe(5);
    expect(archiveRun(r.root, { runId: "../x", deck, report: rep }, gitEnv(r.root)), "invalid").toStrictEqual({
      ok: false,
      error: "invalid runId: ../x",
    });
    expect(fs.existsSync(r.path(".morph/x")), "nothing written for ../x").toBe(false);
  } finally {
    r.rm();
  }
});

test("§2.2: the types; a RunReport is an ArchivedReport", () => {
  expectTypeOf<RunReport>().toMatchTypeOf<ArchivedReport>();
  expectTypeOf(archiveRun).parameters.toEqualTypeOf<[string, ArchiveInput, Record<string, string>]>();
  expectTypeOf(archiveRun).returns.toEqualTypeOf<ArchiveResult>();
  expectTypeOf<ArchiveResult>().toEqualTypeOf<{ ok: true; dir: string; commit: string | null } | { ok: false; error: string }>();
  expectTypeOf<ArchiveInput>().toEqualTypeOf<{ runId: string; deck: Deck; report: ArchivedReport }>();
});
