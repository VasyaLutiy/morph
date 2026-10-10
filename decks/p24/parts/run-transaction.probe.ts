// P24 probe for run-transaction by docs/TASK_P24_transaction.md §2.2 (src/runloop/transaction.ts) — issue #16 items 1–3:
// a card's retries are its own, a retry batch runs by layers, a rolled-back outcome keeps its attempt.
// Record Run Transaction examples 8–11. `stop` and `lastRound` are read through a record, so the probe compiles on the old types.
import { test, expect } from "vitest";
import { TRANSACTION_MARK } from "../../src/cards/transaction.js";
import { runTransaction } from "../../src/runloop/transaction.js";
import { fakeFetch, tmpRoot } from "../../tests/helpers.js";
import type { Card } from "../../src/cards/types.js";
import type { RunDeps, RunInput, RunResult, VariantRecord } from "../../src/runloop/types.js";

const M = TRANSACTION_MARK + "\n";
const fence = (body: string): string => "```ts\n" + body + "```\n";
function card(customId: string, target: string, acceptance: string, dependsOn: string[] = [], contextSlice: string[] = []): Card {
  return { customId, intent: "generate", targets: [target], contextSlice, instruction: "write " + target, acceptance, model: null,
    maxTokens: null, reasoning: null, variants: 1, dependsOn };
}
function deps(root: string, commits: string[], records: VariantRecord[]): RunDeps {
  return { config: { id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync",
      concurrency: 4, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: root },
    transport: { fetch: fakeFetch().fetch, sleep: async () => {} },
    commit: (id, targets) => { commits.push(id); return { commit: "sha-" + id, diffstat: { files: targets.length, insertions: 1, deletions: 0 } }; },
    now: () => 0, env: { PATH: process.env.PATH ?? "" }, onVariant: (rec) => { records.push(rec); } };
}
const input = (root: string, cards: Card[], maxRetryBatches = 2): RunInput => ({ root, runId: "t1", branch: "morph/t1",
  deck: { cards, externalDependsOn: [] }, budget: { maxCards: 99, maxRetryBatches, deadline: 1e12 } });
const once = (mark: string, line: string): string => `[ -f ${mark} ] || { touch ${mark}; echo "${line}"; exit 1; }`;

// one comparable summary per run: a red names every difference at once
function summary(res: RunResult, commits: string[]): Record<string, unknown> {
  const rep = res.report as unknown as Record<string, unknown>;
  return {
    outcomes: res.outcomes.map((o) => ({ id: o.customId, status: o.status, reason: o.reason, attempts: o.attempts,
      winningVariant: o.winningVariant, lastRound: (o as unknown as Record<string, unknown>).lastRound, acceptanceLog: o.acceptanceLog,
      earlierFailures: o.earlierFailures })),
    requests: (res.report.requests ?? []).map((row) => row.customId),
    commits,
    stop: rep.stop,
    fault: rep.fault,
  };
}

test("Run Transaction example 8: rounds red through owners a and b, then on the leaf c; c is still retried and 3/3 commit", async () => {
  const r = tmpRoot("morph-tx-");
  try {
    for (const [f, t] of [["a.md", 'export const a = "A1";\n'], ["b.md", 'export const b = "B2";\n'], ["c.md", 'export const c = "C3";\n'],
      ["a.r1.md", 'export const a = "A4";\n'], ["b.r1.md", 'export const b = "B5";\n'], ["c.r1.md", 'export const c = "C6";\n']]) r.write(f, fence(t));
    const cards = [card("a", "out/a.ts", M + "exit 0"), card("b", "out/b.ts", M + "exit 0"),
      card("c", "out/c.ts", M + once("r0.once", "out/a.ts(1,14): error TS2305: a is old") + "; " + once("r1.once", "out/b.ts(1,14): error TS2305: b is old")
        + "; " + once("r2.once", "c red once"), ["a", "b"])];
    const commits: string[] = [];
    const res = await runTransaction(input(r.root, cards), deps(r.root, commits, []));
    expect(summary(res, commits)).toStrictEqual({
      outcomes: [
        { id: "a", status: "written", reason: null, attempts: 2, winningVariant: "a.r1.v1", lastRound: undefined, acceptanceLog: "", earlierFailures: [] },
        { id: "b", status: "written", reason: null, attempts: 2, winningVariant: "b.r1.v1", lastRound: undefined, acceptanceLog: "", earlierFailures: [] },
        { id: "c", status: "written", reason: null, attempts: 2, winningVariant: "c.r1.v1", lastRound: undefined, acceptanceLog: "",
          earlierFailures: ["out/a.ts(1,14): error TS2305: a is old\n", "out/b.ts(1,14): error TS2305: b is old\n", "c red once\n"] },
      ],
      requests: ["a.v1", "b.v1", "c.v1", "a.r1.v1", "b.r1.v1", "c.r1.v1"],
      commits: ["a.r1", "b.r1", "c.r1"],
      stop: undefined,
      fault: undefined,
    });
    expect(res.report.generations).toBe(2);
    expect(r.read("out/c.ts")).toBe('export const c = "C6";\n');
  } finally {
    r.rm();
  }
});

test("Run Transaction example 9: a dependant retried in the same batch as its dependency is written after it, not stale", async () => {
  const r = tmpRoot("morph-tx-");
  try {
    for (const [f, t] of [["a.md", 'export const a = "A7";\n'], ["a.r1.md", 'export const a = "A8";\n'],
      ["j.md", 'export const j = "J1";\n'], ["j.r1.md", 'export const j = "J2";\n']]) r.write(f, fence(t));
    const cards = [card("a", "out/a.ts", M + once("a.once", "a red once")),
      card("j", "out/j.ts", M + once("j.once", "j red once"), ["a"], ["out/a.ts"])];
    const commits: string[] = [];
    const records: VariantRecord[] = [];
    const res = await runTransaction(input(r.root, cards), deps(r.root, commits, records));
    expect(summary(res, commits)).toStrictEqual({
      outcomes: [
        { id: "a", status: "written", reason: null, attempts: 2, winningVariant: "a.r1.v1", lastRound: undefined, acceptanceLog: "", earlierFailures: ["a red once\n"] },
        { id: "j", status: "written", reason: null, attempts: 2, winningVariant: "j.r1.v1", lastRound: undefined, acceptanceLog: "", earlierFailures: ["j red once\n"] },
      ],
      requests: ["a.v1", "j.v1", "a.r1.v1", "j.r1.v1"],
      commits: ["a.r1", "j.r1"],
      stop: undefined,
      fault: undefined,
    });
    expect(records.map((rec) => rec.request.customId + " " + rec.verdict)).toStrictEqual(["a.v1 accepted", "j.v1 accepted", "a.r1.v1 accepted", "j.r1.v1 accepted"]);
    expect(r.read("out/j.ts")).toBe('export const j = "J2";\n');
  } finally {
    r.rm();
  }
});

test("Run Transaction example 10: a rollback names the exhausted cap; a card green in the last round keeps its retried variant", async () => {
  const r = tmpRoot("morph-tx-");
  try {
    for (const [f, t] of [["a.md", 'export const a = "A2";\n'], ["a.r1.md", 'export const a = "A3";\n'], ["a.r2.md", 'export const a = "A5";\n'],
      ["b.md", 'export const b = "B7";\n'], ["b.r1.md", 'export const b = "B8";\n']]) r.write(f, fence(t));
    const cards = [card("a", "out/a.ts", M + "echo red-a9; exit 1"), card("b", "out/b.ts", M + once("b.once", "b red once"))];
    const commits: string[] = [];
    const res = await runTransaction(input(r.root, cards), deps(r.root, commits, []));
    expect(summary(res, commits)).toStrictEqual({
      outcomes: [
        { id: "a", status: "failed", reason: "acceptance failed", attempts: 3, winningVariant: "a.r2.v1", lastRound: "red", acceptanceLog: "red-a9\n",
          earlierFailures: ["red-a9\n", "red-a9\n"] },
        { id: "b", status: "failed", reason: "transaction rolled back", attempts: 2, winningVariant: "b.r1.v1", lastRound: "green", acceptanceLog: "",
          earlierFailures: ["b red once\n"] },
      ],
      requests: ["a.v1", "b.v1", "a.r1.v1", "b.r1.v1", "a.r2.v1"],
      commits: [],
      stop: "retry cap: a (2 retries)",
      fault: undefined,
    });
    expect(Object.keys(res.report).pop()).toBe("stop");
    expect(r.exists("out/a.ts") || r.exists("out/b.ts")).toBe(false);
  } finally {
    r.rm();
  }
});

test("Run Transaction example 11: maxRetryBatches 1 caps a card's own transaction retries and is named", async () => {
  const r = tmpRoot("morph-tx-");
  try {
    for (const [f, t] of [["a.md", 'export const a = "A2";\n'], ["a.r1.md", 'export const a = "A3";\n'], ["a.r2.md", 'export const a = "A5";\n'],
      ["b.md", 'export const b = "B7";\n']]) r.write(f, fence(t));
    const cards = [card("a", "out/a.ts", M + "echo red-a9; exit 1"), card("b", "out/b.ts", M + "exit 0")];
    const commits: string[] = [];
    const res = await runTransaction(input(r.root, cards, 1), deps(r.root, commits, []));
    expect(summary(res, commits)).toStrictEqual({
      outcomes: [
        { id: "a", status: "failed", reason: "acceptance failed", attempts: 2, winningVariant: "a.r1.v1", lastRound: "red", acceptanceLog: "red-a9\n",
          earlierFailures: ["red-a9\n"] },
        { id: "b", status: "failed", reason: "transaction rolled back", attempts: 1, winningVariant: "b.v1", lastRound: "green", acceptanceLog: "",
          earlierFailures: [] },
      ],
      requests: ["a.v1", "b.v1", "a.r1.v1"],
      commits: [],
      stop: "retry cap: a (maxRetryBatches 1)",
      fault: undefined,
    });
  } finally {
    r.rm();
  }
});
