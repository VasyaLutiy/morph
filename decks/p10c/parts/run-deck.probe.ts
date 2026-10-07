// P10c probe for run-deck: runDeck by docs/TASK_P10c_runner.md §2.2 (issue #3 C2) — the retry budget is per card (2
// retries) and maxRetryBatches caps the retry batches of ONE generation, so a later generation gets its own retries.
// Record Run Deck examples 6-7, then the §2.2 rows (batch cap 0, the cap counted within a generation, example 2 holds).
import { test, expect } from "vitest";
import { runDeck } from "../../src/runloop/deck.js";
import type { Card } from "../../src/cards/types.js";
import type { RunDeps, RunInput } from "../../src/runloop/types.js";
import { fakeFetch, tmpRoot, type TmpRoot } from "../../tests/helpers.js";

function deps(t: TmpRoot, commits: string[]): RunDeps {
  return {
    config: { id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync",
      concurrency: 4, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: t.root },
    transport: { fetch: fakeFetch().fetch, sleep: async (): Promise<void> => {} },
    commit: (customId, targets) => {
      commits.push(customId);
      return { commit: "sha-" + customId, diffstat: { files: targets.length, insertions: 1, deletions: 0 } };
    },
    now: (): number => 100,
    env: { PATH: process.env.PATH ?? "" },
  };
}
const answer = (marker: string): string => '```ts\nexport const value = "' + marker + '";\n```\n';
const card = (customId: string, target: string, acceptance: string, dependsOn: string[] = []): Card => ({ customId,
  intent: "generate", targets: [target], contextSlice: [], instruction: "write " + target, acceptance, model: null,
  maxTokens: null, reasoning: null, variants: 1, dependsOn });
const once = (mark: string, marker: string, target: string): string =>
  "if [ ! -f " + mark + " ]; then touch " + mark + "; exit 1; fi\ngrep -q " + marker + " " + target;
const input = (t: TmpRoot, cards: Card[], maxRetryBatches: number): RunInput => ({ root: t.root, runId: "r", branch: "main",
  deck: { cards, externalDependsOn: [] }, budget: { maxCards: 100, maxRetryBatches, deadline: 1_000_000 } });
const row = (o: { customId: string; status: string; attempts: number; winningVariant: string | null }): string =>
  `${o.customId} ${o.status} ${o.attempts} ${o.winningVariant}`;

test("Run Deck example 6: each generation gets its own retry batch under maxRetryBatches 1", async () => {
  const t = tmpRoot("morph-p10c-");
  try {
    for (const id of ["a", "a.r1"]) t.write(id + ".md", answer("MARK_A"));
    for (const id of ["b", "b.r1"]) t.write(id + ".md", answer("MARK_B"));
    const commits: string[] = [];
    const r = await runDeck(input(t, [card("a", "a.ts", once("mark-a", "MARK_A", "a.ts")),
      card("b", "b.ts", once("mark-b", "MARK_B", "b.ts"), ["a"])], 1), deps(t, commits));
    expect(r.outcomes.map(row), "outcomes").toStrictEqual(["a written 2 a.r1.v1", "b written 2 b.r1.v1"]);
    expect(r.outcomes.map((o) => o.earlierFailures.length), "earlierFailures").toStrictEqual([1, 1]);
    expect(r.report.usageTotals.requests, "requests").toBe(4);
    expect(commits, "commits").toStrictEqual(["a", "b"]);
  } finally {
    t.rm();
  }
});

test("Run Deck example 7: the per-card budget is 2 retries whatever the batch cap", async () => {
  const t = tmpRoot("morph-p10c-");
  try {
    for (const id of ["c", "c.r1", "c.r2", "c.r3"]) t.write(id + ".md", answer("MARK_C"));
    const r = await runDeck(input(t, [card("c", "c.ts", "exit 1")], 8), deps(t, []));
    const c = r.outcomes[0];
    expect(`${c?.status} | ${c?.reason} | ${c?.attempts} | ${c?.earlierFailures.length}`, "c").toBe("failed | acceptance failed | 3 | 2");
    expect(r.report.usageTotals.requests, "requests").toBe(3);
  } finally {
    t.rm();
  }
});

test("§2.2: maxRetryBatches 0 retries nothing in any generation", async () => {
  const t = tmpRoot("morph-p10c-");
  try {
    for (const id of ["a", "a.r1", "b", "b.r1"]) t.write(id + ".md", answer("MARK"));
    const r = await runDeck(input(t, [card("a", "a.ts", "exit 1"), card("b", "b.ts", "exit 1")], 0), deps(t, []));
    expect(r.outcomes.map(row), "outcomes").toStrictEqual(["a failed 1 null", "b failed 1 null"]);
    expect(r.report.usageTotals.requests, "requests").toBe(2);
  } finally {
    t.rm();
  }
});

test("§2.2: the cap counts the batches of one generation (cap 1: one retry each, in two generations)", async () => {
  const t = tmpRoot("morph-p10c-");
  try {
    for (const id of ["a", "a.r1", "a.r2", "b", "b.r1", "b.r2", "c"]) t.write(id + ".md", answer("MARK"));
    const r = await runDeck(input(t, [card("a", "a.ts", "exit 1"), card("c", "c.ts", "exit 0"),
      card("b", "b.ts", "exit 1", ["c"])], 1), deps(t, []));
    expect(r.outcomes.map(row), "outcomes").toStrictEqual(["a failed 2 null", "c written 1 c.v1", "b failed 2 null"]);
    expect(r.report.requests?.map((q) => q.customId), "request ids").toStrictEqual(["a.v1", "c.v1", "a.r1.v1", "b.v1", "b.r1.v1"]);
  } finally {
    t.rm();
  }
});

test("§2.2: Run Deck example 2 holds (a one-card retry under cap 1)", async () => {
  const t = tmpRoot("morph-p10c-");
  try {
    t.write("c.md", answer("MARK_C"));
    t.write("c.r1.md", answer("MARK_C"));
    const r = await runDeck(input(t, [card("c", "c.ts", once("marker", "MARK_C", "c.ts"))], 1), deps(t, []));
    expect(r.outcomes.map(row), "outcomes").toStrictEqual(["c written 2 c.r1.v1"]);
    expect(t.read("c.ts"), "c.ts").toBe('export const value = "MARK_C";\n');
  } finally {
    t.rm();
  }
});
