// P50 probe for run-transaction (src/runloop/transaction.ts) — issue #50 F3: a probe build error is a named
// stop, rollback, no retry. Record runloop-subset/Run Transaction example 16 (new; the log is
// tests/fixtures/cards/probeLogs.json "go", verbatim) and example 14 (P28a, unchanged, green on the stub).
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
function deps(root: string, commits: string[], records: VariantRecord[] = []): RunDeps {
  return { config: { id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync",
      concurrency: 4, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: root },
    transport: { fetch: fakeFetch().fetch, sleep: async () => {} },
    commit: (id, targets) => { commits.push(id); return { commit: "sha-" + id, diffstat: { files: targets.length, insertions: 1, deletions: 0 } }; },
    now: () => 0, env: { PATH: process.env.PATH ?? "" }, onVariant: (rec) => { records.push(rec); } };
}
const input = (root: string, cards: Card[], maxRetryBatches = 2): RunInput => ({ root, runId: "t1", branch: "morph/t1",
  deck: { cards, externalDependsOn: [] }, budget: { maxCards: 99, maxRetryBatches, deadline: 1e12 } });

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

test("Run Transaction example 16: a probe build error stops the run by name, no retry", async () => {
  const L = "users/token-lookup_probe_test.go:30:72: undefined: adaH\nusers/token-lookup_probe_test.go:31:72: undefined: zoeH\n";
  const r = tmpRoot("morph-tx-p50-");
  try {
    r.write("t.md", fence("package users\n\nfunc Token(ada string) string { return ada }\n"));
    const cards = [card("t", "users/token.go", M +
      'echo "users/token-lookup_probe_test.go:30:72: undefined: adaH"; ' +
      'echo "users/token-lookup_probe_test.go:31:72: undefined: zoeH"; exit 1')];
    const commits: string[] = [];
    const records: VariantRecord[] = [];
    const res = await runTransaction(input(r.root, cards), deps(r.root, commits, records));
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
    expect(records.map((rec) => rec.request.customId)).toStrictEqual(["t.v1"]);
    expect(r.exists("users/token.go")).toBe(false);
  } finally {
    r.rm();
  }
});

test("Run Transaction example 14 (P28a, unchanged): a Go red in a kept file of the target's package retries the owner", async () => {
  const L = "calc/b.go:3:31: undefined: fmtOut";
  const r = tmpRoot("morph-tx-p50b-");
  try {
    r.write("calc/b.go", "package calc\n\nfunc Report() string { return fmtOut() }\n");
    r.write("g.md", fence("package calc\n\nfunc Sum(a, b int) int { return a + b }\n"));
    r.write("g.r1.md", fence("package calc\n\nfunc Sum(a, b int) int { return a + b }\n\nfunc fmtOut() string { return \"\" }\n"));
    r.write("gj.md", fence("package calc\n"));
    const cards = [card("g", "calc/a.go", M + 'grep -q fmtOut calc/a.go || { echo "' + L + '"; exit 1; }'),
      card("gj", "calc/a_examples_test.go", M + 'grep -q fmtOut calc/a.go || { echo "vet: ' + L + '"; exit 1; }', ["g"])];
    const commits: string[] = [];
    const records: VariantRecord[] = [];
    const res = await runTransaction(input(r.root, cards), deps(r.root, commits, records));
    const s = summary(res, commits);
    expect(s.stop).toBe(undefined);
    expect(s.fault).toBe(undefined);
    expect((s.requests as string[])).toStrictEqual(["g.v1", "gj.v1", "g.r1.v1"]);
    expect(r.read("calc/a.go")).toContain("fmtOut");
  } finally {
    r.rm();
  }
});