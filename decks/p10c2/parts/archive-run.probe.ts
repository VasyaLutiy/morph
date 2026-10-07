// P10c2 probe for archive-run: the answers/ of the run archive by docs/TASK_P10c2_runner.md §2.2 (issue #3 C4) —
// per answer <customId>.request.json (the request, JSON indent 2 + "\n") and <customId>.answer.txt (the raw text, only
// when not null), committed with deck.json and report.json; an answer id outside ^[A-Za-z0-9._-]+$ refused before
// anything is written; no answers = the P6 archive exactly. Record Archive Run examples 4-5, then the §2.2 rows.
import { test, expect, expectTypeOf } from "vitest";
import fs from "node:fs";
import { archiveRun } from "../../src/git/archive.js";
import type { ArchiveInput, ArchivedAnswer } from "../../src/git/types.js";
import type { Card, Deck } from "../../src/cards/types.js";
import type { CardOutcome, RunReport, VariantRecord } from "../../src/runloop/types.js";
import { tmpRepo } from "../../tests/helpers.js";

function gitEnv(home: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "", HOME: home, GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@example.invalid",
    GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL: "ada@example.invalid",
  };
}
const card = (customId: string): Card => ({
  customId, intent: "generate", targets: [`out/${customId}.ts`], contextSlice: [], instruction: "x",
  acceptance: "true", model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: [],
});
const outcome = (customId: string, status: "written" | "failed"): CardOutcome => ({
  customId, status, reason: null, attempts: 1, winningVariant: null, acceptanceLog: "", earlierFailures: [],
  commit: null, diffstat: null,
});
const report = (runId: string): RunReport => ({
  runId, completedAt: 5, branch: "morph/" + runId, processor: "stub", generations: 1,
  outcomes: [outcome("a", "written"), outcome("b", "failed")],
  usageTotals: { inputTokens: 0, outputTokens: 0, cost: null, requests: 2 },
});
const deck: Deck = { cards: [card("a"), card("b")], externalDependsOn: [] };
const req = (customId: string, content: string): ArchivedAnswer["request"] & Record<string, unknown> => ({
  customId, model: null, maxTokens: null, reasoning: null, messages: [{ role: "user", content }] });
const A_TEXT = "```ts\nexport const a = 1;\n```\n";
const MESSAGE = "morph run r1: deck and report\n\nMorph-Run: r1\nMorph-Cards: 2\nMorph-Written: 1\nMorph-Failed: 1\nMorph-Skipped: 0\nMorph-Budget-Exceeded: 0";

test("Archive Run example 4: answers/ written next to deck and report and committed with them", () => {
  const r = tmpRepo();
  try {
    r.git(["checkout", "-q", "-b", "morph/r1"]);
    const a = req("a.v1", "Write a.");
    const b = req("b.v1", "Write b.");
    const got = archiveRun(r.root, { runId: "r1", deck, report: report("r1"),
      answers: [{ request: a, text: A_TEXT }, { request: b, text: null }] }, gitEnv(r.root));
    expect(got, "result").toStrictEqual({ ok: true, dir: ".morph/runs/r1", commit: r.git(["rev-parse", "HEAD"]) });
    expect(r.read(".morph/runs/r1/answers/a.v1.request.json"), "a request").toBe(JSON.stringify(a, null, 2) + "\n");
    expect(r.read(".morph/runs/r1/answers/a.v1.answer.txt"), "a answer, byte for byte").toBe(A_TEXT);
    expect(r.read(".morph/runs/r1/answers/b.v1.request.json"), "b request").toBe(JSON.stringify(b, null, 2) + "\n");
    expect(r.exists(".morph/runs/r1/answers/b.v1.answer.txt"), "no answer file for a null text").toBe(false);
    expect(r.git(["show", "--name-only", "--format=", "HEAD"]), "committed paths").toBe([
      ".morph/runs/r1/answers/a.v1.answer.txt", ".morph/runs/r1/answers/a.v1.request.json",
      ".morph/runs/r1/answers/b.v1.request.json", ".morph/runs/r1/deck.json", ".morph/runs/r1/report.json"].join("\n"));
    expect(r.git(["log", "-1", "--format=%B"]), "message").toBe(MESSAGE);
    expect(r.git(["status", "--porcelain"]), "clean").toBe("");
  } finally {
    r.rm();
  }
});

test("Archive Run example 5: an invalid answer id is refused before anything is written; [] writes no answers/", () => {
  const r = tmpRepo();
  try {
    const head = r.git(["rev-parse", "HEAD"]);
    const bad = archiveRun(r.root, { runId: "r3", deck, report: report("r3"),
      answers: [{ request: { customId: "../x" }, text: "t" }] }, gitEnv(r.root));
    expect(bad, "refusal").toStrictEqual({ ok: false, error: "invalid answer id: ../x" });
    expect(fs.existsSync(r.path(".morph/runs/r3")), "nothing written").toBe(false);
    expect(r.git(["rev-parse", "HEAD"]), "HEAD unchanged").toBe(head);
    const none = archiveRun(r.root, { runId: "r4", deck, report: report("r4"), answers: [] }, gitEnv(r.root));
    expect(none, "result").toStrictEqual({ ok: true, dir: ".morph/runs/r4", commit: r.git(["rev-parse", "HEAD"]) });
    expect(fs.existsSync(r.path(".morph/runs/r4/answers")), "no answers/").toBe(false);
  } finally {
    r.rm();
  }
});

test("§2.2: without answers the archive is the P6 one (two files committed)", () => {
  const r = tmpRepo();
  try {
    const input: ArchiveInput = { runId: "r1", deck, report: report("r1") };
    expect(archiveRun(r.root, input, gitEnv(r.root)).ok, "ok").toBe(true);
    expect(r.git(["show", "--name-only", "--format=", "HEAD"]), "committed").toBe(".morph/runs/r1/deck.json\n.morph/runs/r1/report.json");
    expect(fs.existsSync(r.path(".morph/runs/r1/answers")), "no answers/").toBe(false);
  } finally {
    r.rm();
  }
});

test("§2.2: the answer id is checked before the existing archive; the first invalid one is named", () => {
  const r = tmpRepo();
  try {
    expect(archiveRun(r.root, { runId: "r1", deck, report: report("r1") }, gitEnv(r.root)).ok, "first").toBe(true);
    const got = archiveRun(r.root, { runId: "r1", deck, report: report("r1"), answers: [{ request: { customId: "ok.v1" }, text: null },
      { request: { customId: "a b" }, text: null }, { request: { customId: "c/d" }, text: null }] }, gitEnv(r.root));
    expect(got, "refusal").toStrictEqual({ ok: false, error: "invalid answer id: a b" });
    expect(archiveRun(r.root, { runId: "r1", deck, report: report("r1"), answers: [] }, gitEnv(r.root)), "exists")
      .toStrictEqual({ ok: false, error: "archive .morph/runs/r1 already exists" });
  } finally {
    r.rm();
  }
});

test("§2.2: an answer text is written exactly (no newline added, empty text kept as an empty file)", () => {
  const r = tmpRepo();
  try {
    const got = archiveRun(r.root, { runId: "r5", deck, report: report("r5"), answers: [
      { request: req("a.v1", "x"), text: "no newline at the end" }, { request: req("a.v2", "x"), text: "" }] }, gitEnv(r.root));
    expect(got.ok, "ok").toBe(true);
    expect(r.read(".morph/runs/r5/answers/a.v1.answer.txt"), "exact").toBe("no newline at the end");
    expect(r.read(".morph/runs/r5/answers/a.v2.answer.txt"), "empty").toBe("");
  } finally {
    r.rm();
  }
});

test("§2.2: the types — ArchivedAnswer, ArchiveInput.answers optional, runloop's records assignable", () => {
  expectTypeOf<ArchivedAnswer>().toEqualTypeOf<{ request: { customId: string }; text: string | null }>();
  expectTypeOf<ArchiveInput["answers"]>().toEqualTypeOf<ArchivedAnswer[] | undefined>();
  expectTypeOf<VariantRecord[]>().toMatchTypeOf<ArchivedAnswer[]>();
});
