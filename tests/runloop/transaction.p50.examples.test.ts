// P50 / issue #50 F3 probe for Run Transaction — example 16: a probe build error stops the run by name, no retry.
import { test, expect } from "vitest";
import { TRANSACTION_MARK } from "../../src/cards/transaction.js";
import { runTransaction } from "../../src/runloop/transaction.js";
import { fakeFetch, tmpRoot } from "../helpers.js";
import type { Card } from "../../src/cards/types.js";
import type { RunDeps, RunInput, RunResult } from "../../src/runloop/types.js";

const M = TRANSACTION_MARK + "\n";
const fence = (body: string): string => "```ts\n" + body + "```\n";
const card = (id: string, target: string, acceptance: string): Card => ({ customId: id, intent: "generate", targets: [target], contextSlice: [], instruction: "write " + target, acceptance, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn: [] });
const deps = (root: string, commits: string[]): RunDeps => ({ config: { id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync", concurrency: 4, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: root }, transport: { fetch: fakeFetch().fetch, sleep: async () => {} }, commit: (id, targets) => { commits.push(id); return { commit: "sha-" + id, diffstat: { files: targets.length, insertions: 1, deletions: 0 } }; }, now: () => 0, env: { PATH: process.env.PATH ?? "" } });

const input = (root: string, cards: Card[]): RunInput => ({ root, runId: "t1", branch: "morph/t1",
  deck: { cards, externalDependsOn: [] }, budget: { maxCards: 99, maxRetryBatches: 2, deadline: 1e12 } });

function summary(res: RunResult, commits: string[]): Record<string, unknown> {
  const rep = res.report as unknown as Record<string, unknown>;
  return {
    outcomes: res.outcomes.map((o) => ({ id: o.customId, status: o.status, reason: o.reason, attempts: o.attempts,
      winningVariant: o.winningVariant, lastRound: (o as unknown as Record<string, unknown>).lastRound,
      acceptanceLog: o.acceptanceLog, earlierFailures: o.earlierFailures })),
    requests: (res.report.requests ?? []).map((row) => row.customId),
    commits,
    rounds: rep.rounds,
    stop: rep.stop,
    fault: rep.fault,
  };
}

test("Run Transaction example 16: a probe build error stops the run by name, no retry", async () => {
  const L = "users/token-lookup_probe_test.go:30:72: undefined: adaH\n" +
    "users/token-lookup_probe_test.go:31:72: undefined: zoeH\n";
  const r = tmpRoot("morph-tx-");
  try {
    r.write("t.md", fence("package users\n\nfunc Token(ada string) string { return ada }\n"));
    const cards = [card("t", "users/token.go",
      M + 'echo "users/token-lookup_probe_test.go:30:72: undefined: adaH"; echo "users/token-lookup_probe_test.go:31:72: undefined: zoeH"; exit 1')];
    const commits: string[] = [];
    const res = await runTransaction(input(r.root, cards), deps(r.root, commits));
    expect(summary(res, commits)).toStrictEqual({
      outcomes: [
        { id: "t", status: "failed", reason: "probe does not build", attempts: 1, winningVariant: "t.v1",
          lastRound: "red", acceptanceLog: L, earlierFailures: [] },
      ],
      requests: ["t.v1"],
      commits: [],
      rounds: [{ round: 0, reds: [{ customId: "t", blamed: ["t"], log: L }] }],
      stop: "probe does not build: users/token-lookup_probe_test.go:30:72: undefined: adaH, users/token-lookup_probe_test.go:31:72: undefined: zoeH",
      fault: undefined,
    });
    expect(Object.keys(res.report).pop()).toBe("stop");
    expect(r.exists("users/token.go")).toBe(false);
  } finally {
    r.rm();
  }
});
