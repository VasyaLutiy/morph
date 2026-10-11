// P28a probe for run-transaction by docs/TASK_P28a_neighbour.md §2.2 (src/runloop/transaction.ts) — issue #22 M2:
// a red naming a kept file of a target's package is the owner's red: retried, not "outside the subset".
// Record Run Transaction examples 14–15. The second call of example 14 (a file in no target's package) is main's
// behaviour, measured, green on main by design. `rounds` and `lastRound` are read through a record.
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

const G_MD = "package calc\n\nfunc Sum(a, b int) int { return a + b }\n";
const G_R1_MD = "package calc\n\nfunc Sum(a, b int) int { return a + b }\n\nfunc fmtOut() string { return \"\" }\n";
function goAnswers(r: { write(p: string, t: string): void }): void {
  r.write("g.md", fence(G_MD));
  r.write("g.r1.md", fence(G_R1_MD));
  r.write("gj.md", fence("package calc\n"));
}

test("Run Transaction example 14: a Go red in a kept file of the target's package blames and retries the code owner; another package faults", async () => {
  const L = "calc/b.go:3:31: undefined: fmtOut";
  const r = tmpRoot("morph-tx-");
  try {
    r.write("calc/b.go", "package calc\n\nfunc Report() string { return fmtOut() }\n");
    goAnswers(r);
    const cards = [card("g", "calc/a.go", M + 'grep -q fmtOut calc/a.go || { echo "' + L + '"; exit 1; }'),
      card("gj", "calc/a_examples_test.go", M + 'grep -q fmtOut calc/a.go || { echo "vet: ' + L + '"; exit 1; }', ["g"])];
    const commits: string[] = [];
    const records: VariantRecord[] = [];
    const res = await runTransaction(input(r.root, cards), deps(r.root, commits, records));
    expect(summary(res, commits)).toStrictEqual({
      outcomes: [
        { id: "g", status: "written", reason: null, attempts: 2, winningVariant: "g.r1.v1", lastRound: undefined, acceptanceLog: "",
          earlierFailures: [L + "\n"] },
        { id: "gj", status: "written", reason: null, attempts: 1, winningVariant: "gj.v1", lastRound: undefined, acceptanceLog: "",
          earlierFailures: ["vet: " + L + "\n"] },
      ],
      requests: ["g.v1", "gj.v1", "g.r1.v1"],
      commits: ["g.r1", "gj"],
      rounds: [{ round: 0, reds: [{ customId: "g", blamed: ["g"], log: L + "\n" }, { customId: "gj", blamed: ["g"], log: "vet: " + L + "\n" }] },
        { round: 1, reds: [] }],
      stop: undefined,
      fault: undefined,
    });
    const retry = records.find((rec) => rec.request.customId === "g.r1.v1");
    expect(retry === undefined ? "" : JSON.stringify(retry.request)).toContain(L);
    expect(r.read("calc/a.go")).toContain("fmtOut");
  } finally {
    r.rm();
  }
  const o = tmpRoot("morph-tx-");
  try {
    o.write("mcp/count.go", "package mcp\n");
    goAnswers(o);
    const X = "mcp/count.go:6:52: undefined: x";
    const cards = [card("g", "calc/a.go", M + 'grep -q fmtOut calc/a.go || { echo "' + X + '"; exit 1; }'),
      card("gj", "calc/a_examples_test.go", M + "exit 0", ["g"])];
    const commits: string[] = [];
    const res = await runTransaction(input(o.root, cards), deps(o.root, commits));
    expect(summary(res, commits)).toStrictEqual({
      outcomes: [
        { id: "g", status: "failed", reason: "outside the subset", attempts: 1, winningVariant: "g.v1", lastRound: "red", acceptanceLog: X + "\n",
          earlierFailures: [] },
        { id: "gj", status: "failed", reason: "transaction rolled back", attempts: 1, winningVariant: "gj.v1", lastRound: "green", acceptanceLog: "",
          earlierFailures: [] },
      ],
      requests: ["g.v1", "gj.v1"],
      commits: [],
      rounds: [{ round: 0, reds: [{ customId: "g", blamed: [], log: X + "\n" }] }],
      stop: undefined,
      fault: "outside the subset: " + X,
    });
    expect(Object.keys(res.report).pop()).toBe("fault");
    expect(o.exists("calc/a.go")).toBe(false);
  } finally {
    o.rm();
  }
});

test("Run Transaction example 15: a TypeScript red in a kept file naming the target's module blames and retries its owner", async () => {
  const T = `out/k.ts(1,10): error TS2305: Module '"./a.js"' has no exported member 'fmtOut'.`;
  const r = tmpRoot("morph-tx-");
  try {
    r.write("out/k.ts", 'import { fmtOut } from "./a.js";\nexport const k = fmtOut;\n');
    r.write("k.log", T + "\n");
    r.write("a.md", fence("export const sum = 1;\n"));
    r.write("a.r1.md", fence("export const sum = 1;\nexport const fmtOut = 2;\n"));
    const commits: string[] = [];
    const records: VariantRecord[] = [];
    const res = await runTransaction(input(r.root, [card("a", "out/a.ts", M + "grep -q fmtOut out/a.ts || { cat k.log; exit 1; }")]),
      deps(r.root, commits, records));
    expect(summary(res, commits)).toStrictEqual({
      outcomes: [
        { id: "a", status: "written", reason: null, attempts: 2, winningVariant: "a.r1.v1", lastRound: undefined, acceptanceLog: "",
          earlierFailures: [T + "\n"] },
      ],
      requests: ["a.v1", "a.r1.v1"],
      commits: ["a.r1"],
      rounds: [{ round: 0, reds: [{ customId: "a", blamed: ["a"], log: T + "\n" }] }, { round: 1, reds: [] }],
      stop: undefined,
      fault: undefined,
    });
    const retry = records.find((rec) => rec.request.customId === "a.r1.v1");
    expect(retry === undefined ? "" : JSON.stringify(retry.request)).toContain("error TS2305");
  } finally {
    r.rm();
  }
});
