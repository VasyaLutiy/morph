// P11c2 probe for run-deck by docs/TASK_P11c2_runner.md §2.2 (issue #5 finding 6) — deps.interrupted, when set, is called
// right before each deadline check (each generation boundary, before now(); each retry batch that would run); a string s
// stops the run as the fault "interrupted by <s>" (P11c1's path: undecided cards skipped "fault", decided ones kept).
// Record Run Deck examples 11-12, then the §2.2 rows.
import { test, expect } from "vitest";
import { runDeck } from "../../src/runloop/deck.js";
import type { Card, Deck } from "../../src/cards/types.js";
import type { RunDeps, RunInput, RunReport } from "../../src/runloop/types.js";
import { fakeFetch, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

const card = (customId: string, acceptance: string, dependsOn: string[] = []): Card => ({
  customId, intent: "generate", targets: [customId + ".ts"], contextSlice: [], instruction: "write " + customId, acceptance,
  model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn });
const fenced = (mark: string): string => "```ts\nexport const x = \"" + mark + "\";\n```\n";
function deps(t: TmpRoot, interrupted: (() => string | null) | undefined, now: () => number = () => 0): RunDeps {
  const d: RunDeps = {
    config: { id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync",
      concurrency: 4, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: t.path("answers") },
    transport: { fetch: fakeFetch().fetch, sleep: async (): Promise<void> => {} },
    commit: (id) => ({ commit: "sha-" + id, diffstat: { files: 1, insertions: 1, deletions: 0 } }),
    now, env: { PATH: process.env.PATH ?? "" } };
  if (interrupted !== undefined) d.interrupted = interrupted;
  return d;
}
const input = (t: TmpRoot, cards: Card[], maxRetryBatches: number, deadline = 1e15): RunInput => ({
  root: t.root, runId: "r11", branch: "morph/r11", deck: { cards, externalDependsOn: [] } as Deck,
  budget: { maxCards: cards.length, maxRetryBatches, deadline } });
const after = (n: number, value: string, calls: { n: number }): (() => string | null) => () => {
  calls.n += 1;
  return calls.n > n ? value : null;
};
const brief = (r: RunReport): string => r.outcomes.map((o) => `${o.customId} ${o.status} ${o.reason} ${o.attempts}`).join("; ");

test("Run Deck example 11: interrupted at the second boundary stops the run as a fault", async () => {
  const t = tmpRoot("morph-p11c2-");
  try {
    t.write("answers/a.md", fenced("MARK_A"));
    t.write("answers/b.md", fenced("MARK_B"));
    const calls = { n: 0 };
    const got = await runDeck(input(t, [card("a", "grep -q MARK_A a.ts"), card("b", "grep -q MARK_B b.ts", ["a"])], 1),
      deps(t, after(1, "SIGTERM", calls)));
    expect(brief(got.report), "outcomes").toBe("a written null 1; b skipped fault 0");
    expect(got.report.fault, "fault").toBe("interrupted by SIGTERM");
    expect(Object.keys(got.report).join(","), "keys").toBe("runId,completedAt,branch,processor,generations,outcomes,usageTotals,requests,fault");
    expect(`${got.report.usageTotals.requests} ${got.report.generations} ${calls.n}`, "requests, generations, calls").toBe("1 2 2");
  } finally {
    t.rm();
  }
});

test("Run Deck example 12: interrupted before a retry batch keeps the failed card's outcome", async () => {
  const t = tmpRoot("morph-p11c2-");
  try {
    t.write("answers/c.md", fenced("C"));
    t.write("answers/c.r1.md", fenced("C1"));
    const calls = { n: 0 };
    const got = await runDeck(input(t, [card("c", "exit 1")], 2), deps(t, after(1, "SIGINT", calls)));
    expect(brief(got.report), "outcomes").toBe("c failed acceptance failed 1");
    expect(`${got.report.fault} | ${got.report.usageTotals.requests} | ${calls.n}`, "fault, requests, calls").toBe("interrupted by SIGINT | 1 | 2");
  } finally {
    t.rm();
  }
});

test("§2.2 rows: any string passes through; checked before the deadline; absent or null changes nothing", async () => {
  const t = tmpRoot("morph-p11c2-");
  try {
    t.write("answers/a.md", fenced("MARK_A"));
    t.write("answers/b.md", fenced("MARK_B"));
    const cards = [card("a", "grep -q MARK_A a.ts"), card("b", "grep -q MARK_B b.ts", ["a"])];
    const s = await runDeck(input(t, cards, 1, 0), deps(t, () => "STOP-7"));
    expect(`${brief(s.report)} | ${s.report.fault} | ${s.report.usageTotals.requests}`, "STOP-7 at the first boundary, deadline passed")
      .toBe("a skipped fault 0; b skipped fault 0 | interrupted by STOP-7 | 0");
    const n = await runDeck(input(t, cards, 1), deps(t, () => null));
    expect(`${brief(n.report)} | ${"fault" in n.report}`, "always null").toBe("a written null 1; b written null 1 | false");
    const u = await runDeck(input(t, cards, 1), deps(t, undefined));
    expect(`${brief(u.report)} | ${"fault" in u.report}`, "absent").toBe("a written null 1; b written null 1 | false");
  } finally {
    t.rm();
  }
});

test("§2.2 rows: no retry batch would run (cap 0) — no check, no fault; the deadline still wins over nothing", async () => {
  const t = tmpRoot("morph-p11c2-");
  try {
    t.write("answers/c.md", fenced("C"));
    const calls = { n: 0 };
    const got = await runDeck(input(t, [card("c", "exit 1")], 0), deps(t, after(1, "SIGINT", calls)));
    expect(`${brief(got.report)} | ${"fault" in got.report} | ${calls.n}`, "cap 0").toBe("c failed acceptance failed 1 | false | 1");
    const d = await runDeck(input(t, [card("c", "exit 1")], 1, 0), deps(t, () => null));
    expect(`${brief(d.report)} | ${"fault" in d.report}`, "deadline, interrupted null").toBe("c budget-exceeded deadline 0 | false");
  } finally {
    t.rm();
  }
});
