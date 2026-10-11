import { expect, test } from "vitest";
import { archiveRun } from "../../src/git/archive.js";
import type { ArchiveInput, ArchiveResult, ArchivedReport } from "../../src/git/types.js";
import type { Card, Deck } from "../../src/cards/types.js";
import type { CardOutcome, RunReport } from "../../src/runloop/types.js";
import { tmpRepo } from "../helpers.js";

const cardA: Card = {
  customId: "a",
  intent: "generate",
  targets: ["out/a.ts"],
  contextSlice: [],
  instruction: "x",
  acceptance: "true",
  model: null,
  maxTokens: null,
  reasoning: null,
  variants: 1,
  dependsOn: [],
};

const cardB: Card = {
  customId: "b",
  intent: "generate",
  targets: ["out/b.ts"],
  contextSlice: [],
  instruction: "y",
  acceptance: "true",
  model: null,
  maxTokens: null,
  reasoning: null,
  variants: 1,
  dependsOn: [],
};

const deck: Deck = { cards: [cardA, cardB], externalDependsOn: [] };

const outcomeWritten: CardOutcome = {
  customId: "a",
  status: "written",
  reason: null,
  attempts: 1,
  winningVariant: null,
  acceptanceLog: "",
  earlierFailures: [],
  commit: null,
  diffstat: null,
};

const outcomeFailed: CardOutcome = {
  customId: "b",
  status: "failed",
  reason: "acceptance exit 1",
  attempts: 2,
  winningVariant: null,
  acceptanceLog: "exit 1",
  earlierFailures: ["variant 1: exit 1"],
  commit: null,
  diffstat: null,
};

const outcomeSkipped: CardOutcome = {
  customId: "c",
  status: "skipped",
  reason: "dependency failed",
  attempts: 0,
  winningVariant: null,
  acceptanceLog: "",
  earlierFailures: [],
  commit: null,
  diffstat: null,
};

const outcomeBudget: CardOutcome = {
  customId: "d",
  status: "budget-exceeded",
  reason: "deadline passed",
  attempts: 1,
  winningVariant: null,
  acceptanceLog: "",
  earlierFailures: [],
  commit: null,
  diffstat: null,
};

const report: RunReport = {
  runId: "r1",
  completedAt: 1700000000000,
  branch: "morph/r1",
  processor: "glm53",
  generations: 1,
  outcomes: [outcomeWritten, outcomeFailed],
  usageTotals: { inputTokens: 100, outputTokens: 40, cost: 0.01, requests: 2 },
};

const reportAll: RunReport = {
  runId: "r5",
  completedAt: 1700000000001,
  branch: "morph/r5",
  processor: "glm53",
  generations: 2,
  outcomes: [outcomeWritten, outcomeFailed, outcomeSkipped, outcomeBudget],
  usageTotals: { inputTokens: 400, outputTokens: 80, cost: 0.04, requests: 8 },
};

const reportCounts: RunReport = {
  runId: "r7",
  completedAt: 1700000000002,
  branch: "morph/r7",
  processor: "glm53",
  generations: 3,
  outcomes: [outcomeWritten, outcomeWritten, outcomeFailed, outcomeFailed, outcomeFailed],
  usageTotals: { inputTokens: 500, outputTokens: 90, cost: 0.05, requests: 10 },
};

const reportEmpty: RunReport = {
  runId: "r6",
  completedAt: 1700000000003,
  branch: "morph/r6",
  processor: "glm53",
  generations: 0,
  outcomes: [],
  usageTotals: { inputTokens: 0, outputTokens: 0, cost: 0, requests: 0 },
};

const reportOdd: ArchivedReport = { outcomes: [{ status: "weird" }, { status: "written" }] };

test("Archive Run example 1: ok, archive written and committed with trailers", () => {
  const r = tmpRepo();
  try {
    r.git(["checkout", "-q", "-b", "morph/r1"]);
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const input: ArchiveInput = { runId: "r1", deck, report };
    const got = archiveRun(r.root, input, env);
    expect(got).toStrictEqual({
      ok: true,
      dir: ".morph/runs/r1",
      commit: r.git(["rev-parse", "HEAD"]),
    });
    expect(r.read(".morph/runs/r1/deck.json")).toBe(JSON.stringify(deck.cards, null, 2) + "\n");
    expect(r.read(".morph/runs/r1/report.json")).toBe(JSON.stringify(report, null, 2) + "\n");
    expect(r.git(["log", "-1", "--format=%B"])).toBe(
      "morph run r1: deck and report\n\n" +
        "Morph-Run: r1\n" +
        "Morph-Cards: 2\n" +
        "Morph-Written: 1\n" +
        "Morph-Failed: 1\n" +
        "Morph-Skipped: 0\n" +
        "Morph-Budget-Exceeded: 0"
    );
    expect(r.git(["show", "--name-only", "--format=", "HEAD"])).toBe(
      ".morph/runs/r1/deck.json\n.morph/runs/r1/report.json"
    );
  } finally {
    r.rm();
  }
});

test("Archive Run example 2: the same run id twice is refused, HEAD and deck.json unchanged", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const input: ArchiveInput = { runId: "r1", deck, report };
    const first = archiveRun(r.root, input, env);
    expect(first).toStrictEqual({
      ok: true,
      dir: ".morph/runs/r1",
      commit: r.git(["rev-parse", "HEAD"]),
    });
    const head = r.git(["rev-parse", "HEAD"]);
    const deckJson = r.read(".morph/runs/r1/deck.json");
    const second = archiveRun(r.root, input, env);
    expect(second).toStrictEqual({ ok: false, error: "archive .morph/runs/r1 already exists" });
    expect(r.git(["rev-parse", "HEAD"])).toBe(head);
    expect(r.read(".morph/runs/r1/deck.json")).toBe(deckJson);
  } finally {
    r.rm();
  }
});

test("Archive Run example 3: an ignored .morph leaves the archive written but uncommitted", () => {
  const r = tmpRepo();
  try {
    r.write(".gitignore", ".morph/\n");
    r.git(["add", ".gitignore"]);
    r.git(["commit", "-q", "-m", "ignore .morph"]);
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const head = r.git(["rev-parse", "HEAD"]);
    const got: ArchiveResult = archiveRun(r.root, { runId: "r2", deck, report }, env);
    const error = got.ok ? "ok" : got.error;
    expect(
      error.startsWith(
        "archive .morph/runs/r2 written but not committed: git add failed (exit 1): "
      )
    ).toBe(true);
    expect(r.exists(".morph/runs/r2/deck.json")).toBe(true);
    expect(r.exists(".morph/runs/r2/report.json")).toBe(true);
    expect(r.git(["rev-parse", "HEAD"])).toBe(head);
  } finally {
    r.rm();
  }
});

test("Archive Run own: an invalid runId with a space is refused and writes nothing", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const head = r.git(["rev-parse", "HEAD"]);
    const got = archiveRun(r.root, { runId: "a b", deck, report }, env);
    expect(got).toStrictEqual({ ok: false, error: "invalid runId: a b" });
    expect(r.exists(".morph")).toBe(false);
    expect(r.git(["rev-parse", "HEAD"])).toBe(head);
  } finally {
    r.rm();
  }
});

test("Archive Run own: an invalid runId with a slash is refused", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const got = archiveRun(r.root, { runId: "r/1", deck, report }, env);
    expect(got).toStrictEqual({ ok: false, error: "invalid runId: r/1" });
    expect(r.exists(".morph")).toBe(false);
  } finally {
    r.rm();
  }
});

test("Archive Run own: all four statuses counted in the trailers", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const got = archiveRun(r.root, { runId: "r5", deck, report: reportAll }, env);
    expect(got).toStrictEqual({
      ok: true,
      dir: ".morph/runs/r5",
      commit: r.git(["rev-parse", "HEAD"]),
    });
    expect(r.git(["log", "-1", "--format=%B"])).toBe(
      "morph run r5: deck and report\n\n" +
        "Morph-Run: r5\n" +
        "Morph-Cards: 2\n" +
        "Morph-Written: 1\n" +
        "Morph-Failed: 1\n" +
        "Morph-Skipped: 1\n" +
        "Morph-Budget-Exceeded: 1"
    );
  } finally {
    r.rm();
  }
});

test("Archive Run own: an empty deck and empty outcomes archive as [] with zero trailers", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const deckEmpty: Deck = { cards: [], externalDependsOn: [] };
    const got = archiveRun(r.root, { runId: "r6", deck: deckEmpty, report: reportEmpty }, env);
    expect(got).toStrictEqual({
      ok: true,
      dir: ".morph/runs/r6",
      commit: r.git(["rev-parse", "HEAD"]),
    });
    expect(r.read(".morph/runs/r6/deck.json")).toBe("[]\n");
    expect(r.git(["log", "-1", "--format=%B"])).toBe(
      "morph run r6: deck and report\n\n" +
        "Morph-Run: r6\n" +
        "Morph-Cards: 0\n" +
        "Morph-Written: 0\n" +
        "Morph-Failed: 0\n" +
        "Morph-Skipped: 0\n" +
        "Morph-Budget-Exceeded: 0"
    );
  } finally {
    r.rm();
  }
});

test("Archive Run own: repeated statuses are counted per outcome", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const got = archiveRun(r.root, { runId: "r7", deck, report: reportCounts }, env);
    expect(got).toStrictEqual({
      ok: true,
      dir: ".morph/runs/r7",
      commit: r.git(["rev-parse", "HEAD"]),
    });
    expect(r.git(["log", "-1", "--format=%B"])).toBe(
      "morph run r7: deck and report\n\n" +
        "Morph-Run: r7\n" +
        "Morph-Cards: 2\n" +
        "Morph-Written: 2\n" +
        "Morph-Failed: 3\n" +
        "Morph-Skipped: 0\n" +
        "Morph-Budget-Exceeded: 0"
    );
  } finally {
    r.rm();
  }
});

test("Archive Run own: an unknown status is counted nowhere", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const got = archiveRun(r.root, { runId: "r8", deck, report: reportOdd }, env);
    expect(got).toStrictEqual({
      ok: true,
      dir: ".morph/runs/r8",
      commit: r.git(["rev-parse", "HEAD"]),
    });
    expect(r.git(["log", "-1", "--format=%B"])).toBe(
      "morph run r8: deck and report\n\n" +
        "Morph-Run: r8\n" +
        "Morph-Cards: 2\n" +
        "Morph-Written: 1\n" +
        "Morph-Failed: 0\n" +
        "Morph-Skipped: 0\n" +
        "Morph-Budget-Exceeded: 0"
    );
  } finally {
    r.rm();
  }
});

test("Archive Run own: a runId of dots, underscores and dashes is accepted", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const got = archiveRun(r.root, { runId: "r.2_x-1", deck, report }, env);
    expect(got).toStrictEqual({
      ok: true,
      dir: ".morph/runs/r.2_x-1",
      commit: r.git(["rev-parse", "HEAD"]),
    });
    expect(r.exists(".morph/runs/r.2_x-1/deck.json")).toBe(true);
    expect(r.exists(".morph/runs/r.2_x-1/report.json")).toBe(true);
  } finally {
    r.rm();
  }
});

test("Archive Run own: the exists check reads the disk, a pre-created dir is untouched", () => {
  const r = tmpRepo();
  try {
    r.write(".morph/runs/r3/deck.json", "old\n");
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const head = r.git(["rev-parse", "HEAD"]);
    const got = archiveRun(r.root, { runId: "r3", deck, report }, env);
    expect(got).toStrictEqual({ ok: false, error: "archive .morph/runs/r3 already exists" });
    expect(r.read(".morph/runs/r3/deck.json")).toBe("old\n");
    expect(r.exists(".morph/runs/r3/report.json")).toBe(false);
    expect(r.git(["rev-parse", "HEAD"])).toBe(head);
  } finally {
    r.rm();
  }
});

test("Archive Run own: the archive commit carries the explicit env identity", () => {
  const r = tmpRepo();
  try {
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const got = archiveRun(r.root, { runId: "r9", deck, report }, env);
    expect(got).toStrictEqual({
      ok: true,
      dir: ".morph/runs/r9",
      commit: r.git(["rev-parse", "HEAD"]),
    });
    expect(r.git(["log", "-1", "--format=%an <%ae> %cn"])).toBe(
      "Ada <ada@example.invalid> Ada"
    );
  } finally {
    r.rm();
  }
});

test("Archive Run own: a dirty README is not swept into the archive commit", () => {
  const r = tmpRepo();
  try {
    r.write("README.md", "hello\n");
    const env = {
      PATH: process.env.PATH ?? "",
      HOME: r.root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Ada",
      GIT_AUTHOR_EMAIL: "ada@example.invalid",
      GIT_COMMITTER_NAME: "Ada",
      GIT_COMMITTER_EMAIL: "ada@example.invalid",
    };
    const got = archiveRun(r.root, { runId: "r10", deck, report }, env);
    expect(got).toStrictEqual({
      ok: true,
      dir: ".morph/runs/r10",
      commit: r.git(["rev-parse", "HEAD"]),
    });
    expect(r.git(["show", "--name-only", "--format=", "HEAD"])).toBe(
      ".morph/runs/r10/deck.json\n.morph/runs/r10/report.json"
    );
    expect(r.git(["status", "--porcelain", "--", "README.md"])).toBe("?? README.md");
  } finally {
    r.rm();
  }
});
