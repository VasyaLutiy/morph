// P7 probe for document: renderDocument, errorDocument, classifyThrown, runExitCode, readDeckFile by
// docs/TASK_P7_cli.md §2.2, one test per record example (Component cli: Emit Document 1-3, Classify
// Error 1-3, Read Deck File 1-3), then the §2.2 rows and the types.
import { test, expect, expectTypeOf } from "vitest";
import fs from "node:fs";
import { classifyThrown, errorDocument, readDeckFile, renderDocument, runExitCode } from "../../src/cli/document.js";
import type { CommandResult, DeckFileResult, ErrorDocument, ErrorKind, ExitCode } from "../../src/cli/types.js";
import type { CardOutcome, CardStatus, RunReport } from "../../src/runloop/types.js";
import type { ArchiveResult } from "../../src/git/types.js";
import { fixture, tmpRoot } from "../../tests/helpers.js";

const outcome = (customId: string, status: CardStatus): CardOutcome => ({
  customId, status, reason: null, attempts: 1, winningVariant: null, acceptanceLog: "", earlierFailures: [],
  commit: null, diffstat: null,
});
const report = (outcomes: CardOutcome[]): RunReport => ({
  runId: "r1", completedAt: 0, branch: "morph/r1", processor: "s", generations: 1, outcomes,
  usageTotals: { inputTokens: 0, outputTokens: 0, cost: 0, requests: outcomes.length },
});
const archived: ArchiveResult = { ok: true, dir: ".morph/runs/r1", commit: "c".repeat(40) };

test("Emit Document example 1: compact, one line, newline-terminated", () => {
  expect(renderDocument({ a: 1, b: [true, null] }, false)).toBe('{"a":1,"b":[true,null]}\n');
});

test("Emit Document example 2: --pretty indents by 2", () => {
  expect(renderDocument({ a: 1, b: [true, null] }, true)).toBe('{\n  "a": 1,\n  "b": [\n    true,\n    null\n  ]\n}\n');
});

test("Emit Document example 3: an error document, keys code, kind, message", () => {
  const doc = errorDocument(4, "UsageError", "unknown command: x");
  expect(doc).toStrictEqual({ error: { code: 4, kind: "UsageError", message: "unknown command: x" } });
  expect(renderDocument(doc, false)).toBe('{"error":{"code":4,"kind":"UsageError","message":"unknown command: x"}}\n');
});

test("Classify Error example 1: a thrown Error is exit 3, RuntimeError, its message", () => {
  expect(classifyThrown(new Error("git add failed (exit 1): fatal: x"))).toStrictEqual({
    code: 3, document: { error: { code: 3, kind: "RuntimeError", message: "git add failed (exit 1): fatal: x" } },
  });
});

test("Classify Error example 2: a thrown non-Error is String(value)", () => {
  expect(classifyThrown("boom")).toStrictEqual({ code: 3, document: { error: { code: 3, kind: "RuntimeError", message: "boom" } } });
  expect(classifyThrown(42)).toStrictEqual({ code: 3, document: { error: { code: 3, kind: "RuntimeError", message: "42" } } });
});

test("Classify Error example 3: the run's exit code from the report and the archive", () => {
  const rows = [
    runExitCode(report([outcome("a", "written"), outcome("b", "written")]), archived),
    runExitCode(report([outcome("a", "written"), outcome("b", "skipped")]), archived),
    runExitCode(report([outcome("a", "written")]), { ok: false, error: "archive .morph/runs/r1 already exists" }),
  ];
  expect(rows.join(" ")).toBe("0 1 3");
});

test("Read Deck File example 1: a valid deck file", () => {
  const r = tmpRoot();
  try {
    r.write("d.json", fixture("decks/tiny.json"));
    const got = readDeckFile(r.root, "d.json");
    expect(got).toStrictEqual({ ok: true, deck: { cards: [{ customId: "a", intent: "generate", targets: ["src/a.ts"],
      contextSlice: [], instruction: "x", acceptance: null, model: null, maxTokens: null, reasoning: null, variants: 1,
      dependsOn: [] }], externalDependsOn: [] } });
  } finally {
    r.rm();
  }
});

test("Read Deck File example 2: a missing file is exit 4, the path as given", () => {
  const r = tmpRoot();
  try {
    expect(readDeckFile(r.root, "nope.json")).toStrictEqual({ ok: false, result: { code: 4,
      document: { error: { code: 4, kind: "UsageError", message: "deck file not found: nope.json" } } } });
  } finally {
    r.rm();
  }
});

test("Read Deck File example 3: an invalid deck is exit 2, every fault", () => {
  const r = tmpRoot();
  try {
    r.write("c.json", fixture("decks/cycle.json"));
    r.write("dup.json", fixture("decks/duplicate.json"));
    expect(readDeckFile(r.root, "c.json")).toStrictEqual({ ok: false, result: { code: 2,
      document: { error: { code: 2, kind: "DeckError", message: "invalid deck: dependsOn: dependsOn cycle a -> b -> a" } } } });
    expect(readDeckFile(r.root, "dup.json")).toStrictEqual({ ok: false, result: { code: 2,
      document: { error: { code: 2, kind: "DeckError", message: "invalid deck: cards[2].customId: duplicate customId b" } } } });
  } finally {
    r.rm();
  }
});

test("§2.2: several faults joined by '; '; a directory is not a deck file; an absolute path", () => {
  const r = tmpRoot();
  try {
    r.write("bad.json", '[{"customId":"a b"}]');
    const got = readDeckFile(r.root, "bad.json");
    const message = got.ok ? "ok" : JSON.stringify(got.result.document);
    expect(message).toBe(JSON.stringify({ error: { code: 2, kind: "DeckError", message:
      "invalid deck: cards[0].customId: customId 'a b' does not match ^[A-Za-z0-9._-]+$; cards[0].intent: intent is required; "
      + "cards[0].targets: targets is required; cards[0].instruction: instruction is required" } }));
    fs.mkdirSync(r.path("dir.json"));
    const dir = readDeckFile(r.root, "dir.json");
    expect(dir.ok ? "ok" : dir.result.code).toBe(4);
    r.write("t.json", fixture("decks/tiny.json"));
    const abs = readDeckFile("/nonexistent-root", r.path("t.json"));
    expect(abs.ok ? abs.deck.cards.length : -1, "absolute path ignores root").toBe(1);
    const notJson = (() => { r.write("x.json", "{"); const x = readDeckFile(r.root, "x.json"); return x.ok ? "ok" : JSON.stringify(x.result.document); })();
    expect(notJson.startsWith('{"error":{"code":2,"kind":"DeckError","message":"invalid deck: deck: deck is not valid JSON: '), notJson).toBe(true);
  } finally {
    r.rm();
  }
});

test("§2.2: failed and budget-exceeded are exit 1; an empty report with the archive ok is 0", () => {
  expect(runExitCode(report([outcome("a", "failed")]), archived)).toBe(1);
  expect(runExitCode(report([outcome("a", "budget-exceeded")]), archived)).toBe(1);
  expect(runExitCode(report([]), archived)).toBe(0);
  expect(runExitCode(report([outcome("a", "failed")]), { ok: false, error: "x" }), "archive first").toBe(3);
});

test("§2.2: the types", () => {
  expectTypeOf<ExitCode>().toEqualTypeOf<0 | 1 | 2 | 3 | 4>();
  expectTypeOf<ErrorKind>().toEqualTypeOf<"UsageError" | "NotYetError" | "DeckError" | "RefusalError" | "RuntimeError">();
  expectTypeOf<ErrorDocument>().toEqualTypeOf<{ error: { code: ExitCode; kind: ErrorKind; message: string } }>();
  expectTypeOf<CommandResult>().toEqualTypeOf<{ code: ExitCode; document: unknown }>();
  expectTypeOf(renderDocument).toEqualTypeOf<(doc: unknown, pretty: boolean) => string>();
  expectTypeOf(errorDocument).toEqualTypeOf<(code: ExitCode, kind: ErrorKind, message: string) => ErrorDocument>();
  expectTypeOf(classifyThrown).toEqualTypeOf<(e: unknown) => CommandResult>();
  expectTypeOf(runExitCode).toEqualTypeOf<(report: RunReport, archive: ArchiveResult) => ExitCode>();
  expectTypeOf(readDeckFile).toEqualTypeOf<(root: string, deckPath: string) => DeckFileResult>();
});
