// P11b probe for run-deck: the deadline before each retry batch by docs/TASK_P11b_processor.md §2.2 (issue #4
// finding 7) — deps.now() >= deadline before a retry batch turns each card it would retry into its outcome with status
// "budget-exceeded", reason "deadline", and runs no retry batch; now() is not called when no retry batch would run.
// Record Run Deck example 8, then the §2.2 rows.
import { test, expect } from "vitest";
import { runDeck } from "../../src/runloop/deck.js";
import type { Card, Deck } from "../../src/cards/types.js";
import type { RunDeps, RunInput } from "../../src/runloop/types.js";
import { fakeFetch, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

const card = (customId: string, acceptance: string, dependsOn: string[] = []): Card => ({
  customId, intent: "generate", targets: [customId + ".ts"], contextSlice: [], instruction: "write " + customId, acceptance,
  model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn });
const ANSWER = "```ts\nexport const x = 1;\n```\n";
function deps(t: TmpRoot, now: () => number, commits: string[]): RunDeps {
  return {
    config: { id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync",
      concurrency: 4, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: t.path("answers") },
    transport: { fetch: fakeFetch().fetch, sleep: async (): Promise<void> => {} },
    commit: (id) => { commits.push(id); return { commit: "sha-" + id, diffstat: { files: 1, insertions: 1, deletions: 0 } }; },
    now, env: { PATH: process.env.PATH ?? "" } };
}
const input = (t: TmpRoot, cards: Card[], maxRetryBatches: number, deadline: number): RunInput => ({
  root: t.root, runId: "r1", branch: "morph/r1", deck: { cards, externalDependsOn: [] } as Deck,
  budget: { maxCards: cards.length, maxRetryBatches, deadline } });
const seq = (first: number, after: number): { now: () => number; calls: () => number } => {
  let n = 0;
  return { now: () => { n += 1; return n === 1 ? first : after; }, calls: () => n };
};

test("Run Deck example 8: a deadline inside a generation stops the run before the retry batch", async () => {
  const t = tmpRoot("morph-p11b-");
  try {
    for (const name of ["c.md", "c.r1.md", "d.md"]) t.write("answers/" + name, ANSWER);
    const commits: string[] = [];
    const clock = seq(0, 5000);
    const got = await runDeck(input(t, [card("c", "exit 1"), card("d", "true", ["c"])], 2, 1000), deps(t, clock.now, commits));
    const [c, d] = got.report.outcomes;
    expect(`${c?.customId} ${c?.status} ${c?.reason} ${c?.attempts}`, "c").toBe("c budget-exceeded deadline 1");
    expect(`${d?.customId} ${d?.status} ${d?.reason}`, "d").toBe("d budget-exceeded deadline");
    expect(`${got.report.usageTotals.requests} ${commits.length}`, "requests, commits").toBe("1 0");
  } finally {
    t.rm();
  }
});

test("§2.2 rows: >= at the deadline; the failure's log kept; no now() call when no retry batch would run", async () => {
  const t = tmpRoot("morph-p11b-");
  try {
    for (const name of ["c.md", "c.r1.md", "a.md"]) t.write("answers/" + name, ANSWER);
    const edge = seq(0, 1000);
    const got = await runDeck(input(t, [card("c", "echo red-c; exit 1")], 2, 1000), deps(t, edge.now, []));
    const c = got.report.outcomes[0];
    expect(`${c?.status} ${c?.reason} ${c?.acceptanceLog}`, "now == deadline").toBe("budget-exceeded deadline red-c\n");
    const early = seq(0, 999);
    const r = await runDeck(input(t, [card("c", "exit 1")], 1, 1000), deps(t, early.now, []));
    expect(`${r.report.outcomes[0]?.status} ${r.report.outcomes[0]?.attempts} ${r.report.usageTotals.requests}`, "before the deadline")
      .toBe("failed 2 2");
    const none = seq(0, 0);
    await runDeck(input(t, [card("a", "true")], 2, 1000), deps(t, none.now, []));
    expect(none.calls(), "boundary + completedAt only").toBe(2);
    const cap = seq(0, 5000);
    const z = await runDeck(input(t, [card("c", "exit 1")], 0, 1000), deps(t, cap.now, []));
    expect(`${z.report.outcomes[0]?.status} ${cap.calls()}`, "cap 0: no retry batch, no deadline check").toBe("failed 2");
  } finally {
    t.rm();
  }
});
