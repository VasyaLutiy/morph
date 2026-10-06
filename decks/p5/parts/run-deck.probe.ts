// P5 probe for run-deck: runDeck by docs/TASK_P5_runloop.md §2.2, one test per record example
// (Component runloop, Function Run Deck) — the end-to-end run of a deck on the stub inside
// vitest: no network, no git. The commit hook and the clock are stand-ins; verifyCard owns the
// only child process.
import { test, expect } from "vitest";
import { runDeck } from "../../src/runloop/deck.js";
import type { Card, Deck } from "../../src/cards/types.js";
import type { CardOutcome, CommitHook, RunBudget, RunDeps, RunInput } from "../../src/runloop/types.js";
import type { ProcessorConfig, Transport } from "../../src/processor/types.js";
import { fakeFetch, tmpRoot } from "../../tests/helpers.js";

const block = (m: string): string => '```ts\nexport const x = "' + m + '";\n```\n';

function stubConfig(answersDir: string): ProcessorConfig {
  return {
    id: "stub",
    type: "stub",
    model: "stub",
    apiKey: null,
    baseUrl: "https://openrouter.ai/api/v1",
    route: "sync",
    concurrency: 4,
    providerOrder: null,
    reasoning: null,
    timeoutMs: 600000,
    maxRetries: 0,
    answersDir,
  };
}
function transport(): Transport {
  const ff = fakeFetch();
  return { fetch: ff.fetch, sleep: async (): Promise<void> => {} };
}
function deps(answersDir: string, commits: string[], now: () => number): RunDeps {
  const commit: CommitHook = (customId, targets) => {
    commits.push(customId);
    return { commit: "sha-" + customId, diffstat: { files: targets.length, insertions: 1, deletions: 0 } };
  };
  return { config: stubConfig(answersDir), transport: transport(), commit, now, env: { PATH: process.env.PATH ?? "" } };
}
const card = (customId: string, acceptance: string, dependsOn: string[] = []): Card => ({
  customId,
  intent: "generate",
  targets: [`out/${customId}.ts`],
  contextSlice: [],
  instruction: "x",
  acceptance,
  model: null,
  maxTokens: null,
  reasoning: null,
  variants: 1,
  dependsOn,
});
const wide: RunBudget = { maxCards: 100, maxRetryBatches: 5, deadline: Number.MAX_SAFE_INTEGER };
const byId = (os: CardOutcome[]): Record<string, CardOutcome> => Object.fromEntries(os.map((o) => [o.customId, o]));

test("Run Deck example 1: a two-generation deck on the stub, both written", async () => {
  const r = tmpRoot();
  try {
    r.write("ans/a.v1.md", block("MARK_A"));
    r.write("ans/b.v1.md", block("MARK_B"));
    const deck: Deck = {
      cards: [card("a", "grep -q MARK_A out/a.ts"), card("b", "grep -q MARK_B out/b.ts", ["a"])],
      externalDependsOn: [],
    };
    const commits: string[] = [];
    const input: RunInput = { root: r.root, runId: "RID", branch: "morph/RID", deck, budget: wide };
    const { report, outcomes } = await runDeck(input, deps(r.path("ans"), commits, (): number => 5));
    expect(report.generations, "two generations").toBe(2);
    expect(outcomes.map((o) => `${o.customId} ${o.status}`).join(" | "), "all written").toBe("a written | b written");
    expect(commits.join(","), "commit order").toBe("a,b");
    expect(`${report.runId} ${report.branch} ${report.processor} ${report.completedAt}`, "report head").toBe("RID morph/RID stub 5");
    expect(report.usageTotals.requests, "requests").toBe(2);
  } finally {
    r.rm();
  }
});

test("Run Deck example 2: a card retried once then accepted", async () => {
  const r = tmpRoot();
  try {
    r.write("ans/a.md", block("MARK_A"));
    r.write("ans/a.r1.md", block("MARK_A"));
    const acc = "if [ -f .tries ]; then exit 0; else : > .tries; exit 1; fi";
    const deck: Deck = { cards: [card("a", acc)], externalDependsOn: [] };
    const commits: string[] = [];
    const input: RunInput = {
      root: r.root,
      runId: "RID",
      branch: "b",
      deck,
      budget: { maxCards: 100, maxRetryBatches: 1, deadline: Number.MAX_SAFE_INTEGER },
    };
    const { outcomes } = await runDeck(input, deps(r.path("ans"), commits, (): number => 0));
    const o = outcomes[0];
    expect(`${o?.status} ${o?.attempts}`, "written on the retry").toBe("written 2");
    expect(o?.earlierFailures.length, "one earlier failure").toBe(1);
    expect(commits.join(","), "committed once, under the retry id").toBe("a.r1");
  } finally {
    r.rm();
  }
});

test("Run Deck example 3: the deadline stops the run at a generation boundary", async () => {
  const r = tmpRoot();
  try {
    r.write("ans/a.v1.md", block("MARK_A"));
    r.write("ans/b.v1.md", block("MARK_B"));
    const deck: Deck = {
      cards: [card("a", "grep -q MARK_A out/a.ts"), card("b", "grep -q MARK_B out/b.ts", ["a"])],
      externalDependsOn: [],
    };
    const times = [0, 20, 20];
    let i = 0;
    const now = (): number => times[Math.min(i++, times.length - 1)] as number;
    const commits: string[] = [];
    const input: RunInput = {
      root: r.root,
      runId: "RID",
      branch: "b",
      deck,
      budget: { maxCards: 100, maxRetryBatches: 5, deadline: 10 },
    };
    const { report, outcomes } = await runDeck(input, deps(r.path("ans"), commits, now));
    const m = byId(outcomes);
    expect(m["a"]?.status, "a written").toBe("written");
    expect(`${m["b"]?.status} ${m["b"]?.reason}`, "b budget-exceeded").toBe("budget-exceeded deadline");
    expect(report.generations, "two generations counted").toBe(2);
  } finally {
    r.rm();
  }
});
