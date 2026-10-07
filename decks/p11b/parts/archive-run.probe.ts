// P11b probe for archive-run: the operator's archive decision of issue #4 (07.10) by docs/TASK_P11b_processor.md §2.2 —
// raw answers and each variant's stderr line (answers/lines.txt) committed; the request copies gzipped under
// requests/ (self-ignored by requests/.gitignore "*\n"), never committed; saveBatchRecord writes .morph/batches/<id>.json
// (issue #4 item 2). Record Archive Run examples 4, 6, 7, then the §2.2 rows.
import { test, expect, expectTypeOf } from "vitest";
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { archiveRun, saveBatchRecord } from "../../src/git/archive.js";
import type { ArchiveInput, ArchivedAnswer } from "../../src/git/types.js";
import type { Card, Deck } from "../../src/cards/types.js";
import type { CardOutcome, RunReport } from "../../src/runloop/types.js";
import { tmpRepo, tmpRoot } from "../../tests/helpers.js";
import type { TmpRepo } from "../../tests/helpers.js";

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
const gz = (r: TmpRepo, rel: string): string => gunzipSync(fs.readFileSync(r.path(rel))).toString("utf8");

test("Archive Run example 4: the answer text committed, the request copies gzipped under requests/, ignored", () => {
  const r = tmpRepo();
  try {
    r.git(["checkout", "-q", "-b", "morph/r1"]);
    const a = req("a.v1", "Write a.");
    const b = req("b.v1", "Write b.");
    const got = archiveRun(r.root, { runId: "r1", deck, report: report("r1"),
      answers: [{ request: a, text: A_TEXT }, { request: b, text: null }] }, gitEnv(r.root));
    expect(got, "result").toStrictEqual({ ok: true, dir: ".morph/runs/r1", commit: r.git(["rev-parse", "HEAD"]) });
    expect(r.read(".morph/runs/r1/answers/a.v1.answer.txt"), "a answer, byte for byte").toBe(A_TEXT);
    expect(`${r.exists(".morph/runs/r1/answers/b.v1.answer.txt")} ${r.exists(".morph/runs/r1/answers/lines.txt")}`,
      "no b answer, no lines.txt").toBe("false false");
    expect(gz(r, ".morph/runs/r1/requests/a.v1.request.json.gz"), "a request").toBe(JSON.stringify(a, null, 2) + "\n");
    expect(gz(r, ".morph/runs/r1/requests/b.v1.request.json.gz"), "b request").toBe(JSON.stringify(b, null, 2) + "\n");
    expect(r.read(".morph/runs/r1/requests/.gitignore"), "requests/.gitignore").toBe("*\n");
    expect(r.exists(".morph/runs/r1/answers/a.v1.request.json"), "no request copy under answers/").toBe(false);
    expect(r.git(["show", "--name-only", "--format=", "HEAD"]), "committed paths").toBe([
      ".morph/runs/r1/answers/a.v1.answer.txt", ".morph/runs/r1/deck.json", ".morph/runs/r1/report.json"].join("\n"));
    expect(r.git(["log", "-1", "--format=%B"]), "message").toBe(MESSAGE);
    expect(r.git(["status", "--porcelain"]), "clean").toBe("");
  } finally {
    r.rm();
  }
});

test("Archive Run example 6: answers/lines.txt holds the stderr lines in order and is committed", () => {
  const r = tmpRepo();
  try {
    const got = archiveRun(r.root, { runId: "r6", deck, report: report("r6"), answers: [
      { request: req("a.v1", "Write a."), text: "A", line: "morph run: a.v1 accepted stage 2 probe finish stop chars 1\n" },
      { request: req("b.v1", "Write b."), text: null, line: "morph run: b.v1 corrupt stage 0 finish none chars none\n" }] }, gitEnv(r.root));
    expect(got.ok, JSON.stringify(got)).toBe(true);
    expect(r.read(".morph/runs/r6/answers/lines.txt"), "lines.txt").toBe(
      "morph run: a.v1 accepted stage 2 probe finish stop chars 1\nmorph run: b.v1 corrupt stage 0 finish none chars none\n");
    expect(r.git(["show", "--name-only", "--format=", "HEAD"]), "committed paths").toBe([".morph/runs/r6/answers/a.v1.answer.txt",
      ".morph/runs/r6/answers/lines.txt", ".morph/runs/r6/deck.json", ".morph/runs/r6/report.json"].join("\n"));
    expect(r.exists(".morph/runs/r6/requests/a.v1.request.json.gz"), "on disk").toBe(true);
    expect(r.git(["check-ignore", ".morph/runs/r6/requests/a.v1.request.json.gz"]), "ignored")
      .toBe(".morph/runs/r6/requests/a.v1.request.json.gz");
    expect(r.git(["status", "--porcelain"]), "clean").toBe("");
  } finally {
    r.rm();
  }
});

test("Archive Run example 7: saveBatchRecord writes .morph/batches/<batchId>.json; a bad id writes nothing", () => {
  const t = tmpRoot("morph-p11b-");
  try {
    const record = { batchId: "batch-1791388269-cp5qOr5IQ0xoz1ntuc8W", processor: "night", model: "acme/m:batch",
      customIds: ["clamp-value.v1"], status: "in_progress", cost: null };
    expect(saveBatchRecord(t.root, record), "path").toBe(".morph/batches/batch-1791388269-cp5qOr5IQ0xoz1ntuc8W.json");
    expect(t.read(".morph/batches/batch-1791388269-cp5qOr5IQ0xoz1ntuc8W.json"), "file").toBe(JSON.stringify(record, null, 2) + "\n");
    expect(saveBatchRecord(t.root, { ...record, batchId: "../x" }), "bad id").toBeNull();
    expect(saveBatchRecord(t.root, { ...record, batchId: "a b" }), "an id outside ^[A-Za-z0-9._-]+$ (a space)").toBeNull();
    expect(`${fs.readdirSync(t.path(".morph/batches")).join(",")} ${t.exists(".morph/x.json")}`, "nothing else")
      .toBe("batch-1791388269-cp5qOr5IQ0xoz1ntuc8W.json false");
    const later = { ...record, status: "completed", cost: 0.25 };
    expect(saveBatchRecord(t.root, later), "overwrite").not.toBeNull();
    expect((JSON.parse(t.read(".morph/batches/batch-1791388269-cp5qOr5IQ0xoz1ntuc8W.json")) as { status: string }).status, "overwritten")
      .toBe("completed");
  } finally {
    t.rm();
  }
});

test("§2.2 rows: answers without text or line write no answers/; [] and absent write neither directory", () => {
  const r = tmpRepo();
  try {
    const got = archiveRun(r.root, { runId: "r2", deck, report: report("r2"), answers: [{ request: req("b.v1", "x"), text: null }] },
      gitEnv(r.root));
    expect(got.ok, "ok").toBe(true);
    expect(`${r.exists(".morph/runs/r2/answers")} ${r.exists(".morph/runs/r2/requests/b.v1.request.json.gz")}`, "dirs").toBe("false true");
    expect(r.git(["show", "--name-only", "--format=", "HEAD"]), "committed").toBe(".morph/runs/r2/deck.json\n.morph/runs/r2/report.json");
    const none = archiveRun(r.root, { runId: "r4", deck, report: report("r4"), answers: [] }, gitEnv(r.root));
    expect(none.ok, "ok").toBe(true);
    const input: ArchiveInput = { runId: "r5", deck, report: report("r5") };
    expect(archiveRun(r.root, input, gitEnv(r.root)).ok, "absent").toBe(true);
    for (const id of ["r4", "r5"])
      expect(`${r.exists(`.morph/runs/${id}/answers`)} ${r.exists(`.morph/runs/${id}/requests`)}`, id).toBe("false false");
    const bad = archiveRun(r.root, { runId: "r3", deck, report: report("r3"), answers: [{ request: { customId: "../x" }, text: "t" }] },
      gitEnv(r.root));
    expect(`${JSON.stringify(bad)} ${r.exists(".morph/runs/r3")}`, "refusal").toBe('{"ok":false,"error":"invalid answer id: ../x"} false');
    expect(r.git(["status", "--porcelain"]), "clean").toBe("");
  } finally {
    r.rm();
  }
  expectTypeOf<ArchivedAnswer>().toEqualTypeOf<{ request: { customId: string }; text: string | null; line?: string }>();
  expectTypeOf(saveBatchRecord).toEqualTypeOf<(root: string, record: { batchId: string }) => string | null>();
});
