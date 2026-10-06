import { test, expect } from "vitest";
import {
  renderDocument,
  errorDocument,
  classifyThrown,
  runExitCode,
  readDeckFile,
} from "../../src/cli/document.js";
import type { ErrorDocument } from "../../src/cli/types.js";
import type { CardOutcome, RunReport } from "../../src/runloop/types.js";
import type { ArchiveResult } from "../../src/git/types.js";
import { tmpRoot, fixture } from "../helpers.js";

function outcome(customId: string, status: CardOutcome["status"]): CardOutcome {
  return {
    customId,
    status,
    reason: null,
    attempts: 1,
    winningVariant: null,
    acceptanceLog: "",
    earlierFailures: [],
    commit: null,
    diffstat: null,
  };
}

function report(outcomes: CardOutcome[]): RunReport {
  return {
    runId: "r1",
    completedAt: 1791310149000,
    branch: "morph/r1",
    processor: "stub",
    generations: 1,
    outcomes,
    usageTotals: { inputTokens: 0, outputTokens: 0, cost: 0, requests: 0 },
  };
}

const okArchive: ArchiveResult = { ok: true, dir: ".morph/runs/r1", commit: "abc123" };
const badArchive: ArchiveResult = { ok: false, error: "archive failed" };

test("Emit Document example 1: compact JSON plus a newline", () => {
  expect(renderDocument({ a: 1, b: [true, null] }, false)).toBe(
    '{"a":1,"b":[true,null]}\n',
  );
});

test("Emit Document example 2: pretty JSON with the two-space indent", () => {
  expect(renderDocument({ a: 1, b: [true, null] }, true)).toBe(
    '{\n  "a": 1,\n  "b": [\n    true,\n    null\n  ]\n}\n',
  );
});

test("Emit Document example 3: compact render of an error document", () => {
  const doc = errorDocument(4, "UsageError", "unknown command: x");
  expect(renderDocument(doc, false)).toBe(
    '{"error":{"code":4,"kind":"UsageError","message":"unknown command: x"}}\n',
  );
});

test("Classify Error example 1: a thrown Error becomes a RuntimeError document", () => {
  expect(classifyThrown(new Error("git add failed (exit 1): fatal: x"))).toStrictEqual({
    code: 3,
    document: {
      error: {
        code: 3,
        kind: "RuntimeError",
        message: "git add failed (exit 1): fatal: x",
      },
    },
  });
});

test("Classify Error example 2: a thrown string becomes a RuntimeError document", () => {
  expect(classifyThrown("boom")).toStrictEqual({
    code: 3,
    document: { error: { code: 3, kind: "RuntimeError", message: "boom" } },
  });
});

test("Classify Error example 3: runExitCode is 0, 1 and 3 by outcomes and archive", () => {
  expect(
    runExitCode(report([outcome("a", "written"), outcome("b", "written")]), okArchive),
  ).toBe(0);
  expect(
    runExitCode(report([outcome("a", "written"), outcome("b", "skipped")]), okArchive),
  ).toBe(1);
  expect(runExitCode(report([outcome("a", "written")]), badArchive)).toBe(3);
});

test("Read Deck File example 1: a tiny deck with every default filled", () => {
  const r = tmpRoot();
  try {
    r.write("d.json", fixture("decks/tiny.json"));
    const got = readDeckFile(r.root, "d.json");
    expect(got.ok).toBe(true);
    if (got.ok) {
      expect(got.deck).toStrictEqual({
        cards: [
          {
            customId: "a",
            intent: "generate",
            targets: ["src/a.ts"],
            contextSlice: [],
            instruction: "x",
            acceptance: null,
            model: null,
            maxTokens: null,
            reasoning: null,
            variants: 1,
            dependsOn: [],
          },
        ],
        externalDependsOn: [],
      });
    }
  } finally {
    r.rm();
  }
});

test("Read Deck File example 2: a missing file is a UsageError with the path as given", () => {
  const r = tmpRoot();
  try {
    const got = readDeckFile(r.root, "nope.json");
    expect(got).toStrictEqual({
      ok: false,
      result: {
        code: 4,
        document: {
          error: {
            code: 4,
            kind: "UsageError",
            message: "deck file not found: nope.json",
          },
        },
      },
    });
  } finally {
    r.rm();
  }
});

test("Read Deck File example 3: cycle and duplicate fixtures are DeckErrors", () => {
  const r = tmpRoot();
  try {
    r.write("c.json", fixture("decks/cycle.json"));
    r.write("dup.json", fixture("decks/duplicate.json"));
    const cycle = readDeckFile(r.root, "c.json");
    const dup = readDeckFile(r.root, "dup.json");
    expect(cycle.ok).toBe(false);
    expect(dup.ok).toBe(false);
    if (!cycle.ok && !dup.ok) {
      const cycleDoc = cycle.result.document as ErrorDocument;
      const dupDoc = dup.result.document as ErrorDocument;
      expect(cycle.result.code).toBe(2);
      expect(cycleDoc.error.kind).toBe("DeckError");
      expect(cycleDoc.error.message).toBe(
        "invalid deck: dependsOn: dependsOn cycle a -> b -> a",
      );
      expect(dup.result.code).toBe(2);
      expect(dupDoc.error.kind).toBe("DeckError");
      expect(dupDoc.error.message).toBe(
        "invalid deck: cards[2].customId: duplicate customId b",
      );
    }
  } finally {
    r.rm();
  }
});

test("renderDocument quotes a bare string document", () => {
  expect(renderDocument("x", false)).toBe('"x"\n');
});

test("errorDocument builds the three-field error object", () => {
  expect(errorDocument(2, "DeckError", "m")).toStrictEqual({
    error: { code: 2, kind: "DeckError", message: "m" },
  });
});

test("classifyThrown stringifies a thrown non-Error value", () => {
  expect(classifyThrown(42)).toStrictEqual({
    code: 3,
    document: { error: { code: 3, kind: "RuntimeError", message: "42" } },
  });
});

test("runExitCode is 0 on an empty outcomes list with an ok archive", () => {
  expect(runExitCode(report([]), okArchive)).toBe(0);
});

test("runExitCode is 1 on a failed outcome", () => {
  expect(
    runExitCode(report([outcome("a", "written"), outcome("b", "failed")]), okArchive),
  ).toBe(1);
});

test("runExitCode is 1 on a budget-exceeded outcome", () => {
  expect(runExitCode(report([outcome("a", "budget-exceeded")]), okArchive)).toBe(1);
});

test("readDeckFile treats a directory as not found", () => {
  const r = tmpRoot();
  try {
    r.write("sub/keep.txt", "x");
    const got = readDeckFile(r.root, "sub");
    expect(got.ok).toBe(false);
    if (!got.ok) {
      const doc = got.result.document as ErrorDocument;
      expect(got.result.code).toBe(4);
      expect(doc.error.kind).toBe("UsageError");
      expect(doc.error.message).toBe("deck file not found: sub");
    }
  } finally {
    r.rm();
  }
});

test("readDeckFile reports invalid JSON as a DeckError", () => {
  const r = tmpRoot();
  try {
    r.write("bad.json", "{");
    const got = readDeckFile(r.root, "bad.json");
    expect(got.ok).toBe(false);
    if (!got.ok) {
      const doc = got.result.document as ErrorDocument;
      expect(got.result.code).toBe(2);
      expect(doc.error.kind).toBe("DeckError");
      expect(doc.error.message).toContain("invalid deck: deck: deck is not valid JSON: ");
    }
  } finally {
    r.rm();
  }
});
