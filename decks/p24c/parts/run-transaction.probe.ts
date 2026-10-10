// P24c probe for run-transaction by docs/TASK_P24c_blame.md §2.2 (src/runloop/transaction.ts) — issue #19 items 1–3:
// a test red seen by many cards retries only its owner; a red no card owns stops, named; every round is kept.
// Record Run Transaction examples 12–13. `rounds`, `stop` and `lastRound` are read through a record, so the probe
// compiles on main's types.
import { test, expect } from "vitest";
import { TRANSACTION_MARK } from "../../src/cards/transaction.js";
import { runTransaction } from "../../src/runloop/transaction.js";
import { fakeFetch, tmpRoot } from "../../tests/helpers.js";
import type { Card } from "../../src/cards/types.js";
import type { RunDeps, RunInput, RunResult } from "../../src/runloop/types.js";

const M = TRANSACTION_MARK + "\n";
const fence = (body: string): string => "```ts\n" + body + "```\n";
function card(customId: string, target: string, acceptance: string, dependsOn: string[] = [], contextSlice: string[] = []): Card {
  return { customId, intent: "generate", targets: [target], contextSlice, instruction: "write " + target, acceptance, model: null,
    maxTokens: null, reasoning: null, variants: 1, dependsOn };
}
function deps(root: string, commits: string[]): RunDeps {
  return { config: { id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync",
      concurrency: 4, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: root },
    transport: { fetch: fakeFetch().fetch, sleep: async () => {} },
    commit: (id, targets) => { commits.push(id); return { commit: "sha-" + id, diffstat: { files: targets.length, insertions: 1, deletions: 0 } }; },
    now: () => 0, env: { PATH: process.env.PATH ?? "" } };
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
    rounds: rep.rounds,
    stop: rep.stop,
    fault: rep.fault,
  };
}

test("Run Transaction example 12: a test red two cards saw blames only the test file's owner; only it is retried", async () => {
  const r = tmpRoot("morph-tx-");
  try {
    for (const [f, t] of [["a.md", 'export const a = "A1";\n'], ["c.md", 'export const c = "C3";\n'],
      ["j.md", 'export const j = "J1";\n'], ["j.r1.md", 'export const j = "J2";\n']]) r.write(f, fence(t));
    const T = " FAIL  out/j.test.ts > j";
    const cards = [card("a", "out/a.ts", M + "exit 0"), card("c", "out/c.ts", M + once("c.once", T)),
      card("j", "out/j.test.ts", M + once("j.once", T), ["a"])];
    const commits: string[] = [];
    const res = await runTransaction(input(r.root, cards), deps(r.root, commits));
    const log = T + "\n";
    expect(summary(res, commits)).toStrictEqual({
      outcomes: [
        { id: "a", status: "written", reason: null, attempts: 1, winningVariant: "a.v1", lastRound: undefined, acceptanceLog: "", earlierFailures: [] },
        { id: "c", status: "written", reason: null, attempts: 1, winningVariant: "c.v1", lastRound: undefined, acceptanceLog: "", earlierFailures: [log] },
        { id: "j", status: "written", reason: null, attempts: 2, winningVariant: "j.r1.v1", lastRound: undefined, acceptanceLog: "", earlierFailures: [log] },
      ],
      requests: ["a.v1", "c.v1", "j.v1", "j.r1.v1"],
      commits: ["a", "c", "j.r1"],
      rounds: [{ round: 0, reds: [{ customId: "c", blamed: ["j"], log }, { customId: "j", blamed: ["j"], log }] }, { round: 1, reds: [] }],
      stop: undefined,
      fault: undefined,
    });
    expect(r.read("out/j.test.ts")).toBe('export const j = "J2";\n');
  } finally {
    r.rm();
  }
});

test("Run Transaction example 13: a red on a test file no card owns stops the transaction, named, with no retry", async () => {
  const r = tmpRoot("morph-tx-");
  try {
    for (const [f, t] of [["a.md", 'export const a = "A1";\n'], ["b.md", 'export const b = "B2";\n']]) r.write(f, fence(t));
    const cards = [card("a", "out/a.ts", M + "exit 0"),
      card("b", "out/b.ts", M + 'touch out/zz.test.ts; echo " FAIL  out/zz.test.ts > zz"; exit 1')];
    const commits: string[] = [];
    const res = await runTransaction(input(r.root, cards), deps(r.root, commits));
    const log = " FAIL  out/zz.test.ts > zz\n";
    expect(summary(res, commits)).toStrictEqual({
      outcomes: [
        { id: "a", status: "failed", reason: "transaction rolled back", attempts: 1, winningVariant: "a.v1", lastRound: "green", acceptanceLog: "",
          earlierFailures: [] },
        { id: "b", status: "failed", reason: "transaction rolled back", attempts: 1, winningVariant: "b.v1", lastRound: "red", acceptanceLog: log,
          earlierFailures: [] },
      ],
      requests: ["a.v1", "b.v1"],
      commits: [],
      rounds: [{ round: 0, reds: [{ customId: "b", blamed: [], log }] }],
      stop: "unattributed red: b",
      fault: undefined,
    });
    expect(Object.keys(res.report).slice(-2)).toStrictEqual(["rounds", "stop"]);
    expect(r.exists("out/a.ts") || r.exists("out/b.ts")).toBe(false);
  } finally {
    r.rm();
  }
});
