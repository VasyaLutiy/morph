import { expect, test } from "vitest";
import { archiveRun } from "../../src/git/archive.js";
import type { ArchivedAnswer } from "../../src/git/types.js";
import type { Card, Deck } from "../../src/cards/types.js";
import type { CardOutcome, RunReport } from "../../src/runloop/types.js";
import { tmpRepo, tmpRoot } from "../helpers.js";

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

test("Archive Run example 4", () => {
  const r = tmpRepo();
  const home = tmpRoot("morph-home-");
  try {
    r.git(["checkout", "-q", "-b", "morph/r1"]);
    const cardA: Card = {
      customId: "a",
      intent: "generate",
      targets: ["src/a.ts"],
      contextSlice: [],
      instruction: "Write a.",
      acceptance: null,
      model: null,
      maxTokens: null,
      reasoning: null,
      variants: 1,
      dependsOn: [],
    };
    const cardB: Card = {
      customId: "b",
      intent: "generate",
      targets: ["src/b.ts"],
      contextSlice: [],
      instruction: "Write b.",
      acceptance: null,
      model: null,
      maxTokens: null,
      reasoning: null,
      variants: 1,
      dependsOn: [],
    };
    const deck: Deck = { cards: [cardA, cardB], externalDependsOn: [] };
    const outcomeA: CardOutcome = {
      customId: "a",
      status: "written",
      reason: null,
      attempts: 1,
      winningVariant: "a.v1",
      acceptanceLog: "== tsc\n",
      earlierFailures: [],
      commit: "sha-a",
      diffstat: { files: 1, insertions: 1, deletions: 0 },
    };
    const outcomeB: CardOutcome = {
      customId: "b",
      status: "failed",
      reason: "all variants rejected",
      attempts: 1,
      winningVariant: null,
      acceptanceLog: "== tsc\nred\n",
      earlierFailures: [],
      commit: null,
      diffstat: null,
    };
    const report: RunReport = {
      runId: "r1",
      completedAt: 1000,
      branch: "morph/r1",
      processor: "stub",
      generations: 1,
      outcomes: [outcomeA, outcomeB],
      usageTotals: { inputTokens: 10, outputTokens: 20, cost: null, requests: 2 },
      requests: [],
    };
    const textA = "```ts\nexport const a = 1;\n```\n";
    const requestA = {
      customId: "a.v1",
      model: null,
      maxTokens: null,
      reasoning: null,
      messages: [{ role: "user", content: "Write a." }],
    };
    const requestB = {
      customId: "b.v1",
      model: null,
      maxTokens: null,
      reasoning: null,
      messages: [{ role: "user", content: "Write b." }],
    };
    const answers: ArchivedAnswer[] = [
      { request: requestA, text: textA },
      { request: requestB, text: null },
    ];
    const result = archiveRun(r.root, { runId: "r1", deck, report, answers }, gitEnv(home.root));
    expect(result).toStrictEqual({ ok: true, dir: ".morph/runs/r1", commit: r.git(["rev-parse", "HEAD"]) });
    expect(r.read(".morph/runs/r1/answers/a.v1.request.json")).toBe(JSON.stringify(requestA, null, 2) + "\n");
    expect(r.read(".morph/runs/r1/answers/a.v1.answer.txt")).toBe(textA);
    expect(r.read(".morph/runs/r1/answers/b.v1.request.json")).toBe(JSON.stringify(requestB, null, 2) + "\n");
    expect(r.exists(".morph/runs/r1/answers/b.v1.answer.txt")).toBe(false);
    expect(r.git(["show", "--name-only", "--format=", "HEAD"]).split("\n")).toStrictEqual([
      ".morph/runs/r1/answers/a.v1.answer.txt",
      ".morph/runs/r1/answers/a.v1.request.json",
      ".morph/runs/r1/answers/b.v1.request.json",
      ".morph/runs/r1/deck.json",
      ".morph/runs/r1/report.json",
    ]);
    expect(r.git(["log", "-1", "--format=%B"])).toBe(
      "morph run r1: deck and report\n\nMorph-Run: r1\nMorph-Cards: 2\nMorph-Written: 1\nMorph-Failed: 1\nMorph-Skipped: 0\nMorph-Budget-Exceeded: 0"
    );
  } finally {
    r.rm();
    home.rm();
  }
});

test("Archive Run example 5", () => {
  const r = tmpRepo();
  const home = tmpRoot("morph-home-");
  try {
    const deck: Deck = { cards: [], externalDependsOn: [] };
    const report: RunReport = {
      runId: "r3",
      completedAt: 2000,
      branch: "main",
      processor: "stub",
      generations: 1,
      outcomes: [],
      usageTotals: { inputTokens: 0, outputTokens: 0, cost: null, requests: 0 },
      requests: [],
    };
    const headBefore = r.git(["rev-parse", "HEAD"]);
    const bad = archiveRun(
      r.root,
      { runId: "r3", deck, report, answers: [{ request: { customId: "../x" }, text: "t" }] },
      gitEnv(home.root)
    );
    expect(bad).toStrictEqual({ ok: false, error: "invalid answer id: ../x" });
    expect(r.exists(".morph/runs/r3")).toBe(false);
    expect(r.git(["rev-parse", "HEAD"])).toBe(headBefore);
    const good = archiveRun(r.root, { runId: "r4", deck, report, answers: [] }, gitEnv(home.root));
    expect(good).toStrictEqual({ ok: true, dir: ".morph/runs/r4", commit: r.git(["rev-parse", "HEAD"]) });
    expect(r.exists(".morph/runs/r4/answers")).toBe(false);
  } finally {
    r.rm();
    home.rm();
  }
});
