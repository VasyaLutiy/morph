// P11c probe for run-deck by docs/TASK_P11c_runner.md §2.2 (issue #5 findings 1 and 2) — a thrown Error stops the run
// and becomes report.fault (every card with no outcome "skipped", reason "fault"; Run Deck never rejects); a pending
// card whose dependency failed with retries left gets the carried-over retry batch BEFORE its generation resolves.
// Record Run Deck examples 9-10, then the §2.2 rows.
import { test, expect } from "vitest";
import { runDeck } from "../../src/runloop/deck.js";
import type { Card, Deck } from "../../src/cards/types.js";
import type { CommitHook, RunDeps, RunInput, RunReport } from "../../src/runloop/types.js";
import { fakeFetch, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

const card = (customId: string, acceptance: string, dependsOn: string[] = []): Card => ({
  customId, intent: "generate", targets: [customId + ".ts"], contextSlice: [], instruction: "write " + customId, acceptance,
  model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn });
const fenced = (mark: string): string => "```ts\nexport const x = \"" + mark + "\";\n```\n";
function deps(t: TmpRoot, commit: CommitHook): RunDeps {
  return {
    config: { id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync",
      concurrency: 4, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: t.path("answers") },
    transport: { fetch: fakeFetch().fetch, sleep: async (): Promise<void> => {} },
    commit, now: () => 0, env: { PATH: process.env.PATH ?? "" } };
}
const input = (t: TmpRoot, cards: Card[], maxRetryBatches: number): RunInput => ({
  root: t.root, runId: "r9", branch: "morph/r9", deck: { cards, externalDependsOn: [] } as Deck,
  budget: { maxCards: cards.length, maxRetryBatches, deadline: 1e15 } });
const recorder = (fired: string[], throwOn: string | null, thrown: unknown): CommitHook => (id) => {
  fired.push(id);
  if (id === throwOn) throw thrown;
  return { commit: "sha-" + id, diffstat: { files: 1, insertions: 1, deletions: 0 } };
};
const brief = (r: RunReport): string => r.outcomes.map((o) => `${o.customId} ${o.status} ${o.reason} ${o.attempts}`).join("; ");
const grep = (mark: string, file: string): string => `grep -q ${mark} ${file}`;

test("Run Deck example 9: a thrown commit hook ends the run with report.fault; the undecided cards are skipped", async () => {
  const t = tmpRoot("morph-p11c-");
  try {
    for (const id of ["a", "b", "c"]) t.write(`answers/${id}.md`, fenced("MARK_" + id.toUpperCase()));
    const fired: string[] = [];
    const got = await runDeck(input(t, [card("a", grep("MARK_A", "a.ts")), card("b", grep("MARK_B", "b.ts"), ["a"]),
      card("c", grep("MARK_C", "c.ts"), ["b"])], 1), deps(t, recorder(fired, "b", new Error("index.lock: File exists"))));
    expect(brief(got.report), "outcomes").toBe("a written null 1; b skipped fault 0; c skipped fault 0");
    expect(got.report.fault, "fault").toBe("index.lock: File exists");
    expect(Object.keys(got.report).join(","), "keys").toBe("runId,completedAt,branch,processor,generations,outcomes,usageTotals,requests,fault");
    expect(`${got.report.outcomes[0]?.commit} ${got.report.generations} ${got.report.usageTotals.requests} ${fired.join(",")}`, "a, gens, usage, hook")
      .toBe("sha-a 3 1 a,b");
    expect(got.outcomes, "outcomes = report.outcomes").toStrictEqual(got.report.outcomes);
    const b = got.report.outcomes[1];
    expect(b, "a skipped fault outcome").toStrictEqual({ customId: "b", status: "skipped", reason: "fault", attempts: 0, winningVariant: null,
      acceptanceLog: "", earlierFailures: [], commit: null, diffstat: null });
  } finally {
    t.rm();
  }
});

test("Run Deck example 10: a dependency written by a carried-over retry unblocks its dependant", async () => {
  const t = tmpRoot("morph-p11c-");
  try {
    t.write("answers/a.md", fenced("none"));
    t.write("answers/a.r1.md", fenced("none"));
    t.write("answers/a.r2.md", fenced("MARK_A"));
    t.write("answers/b.md", fenced("MARK_B"));
    const fired: string[] = [];
    const got = await runDeck(input(t, [card("a", grep("MARK_A", "a.ts")), card("b", grep("MARK_B", "b.ts"), ["a"])], 1),
      deps(t, recorder(fired, null, null)));
    expect(brief(got.report), "outcomes").toBe("a written null 3; b written null 1");
    expect(`${got.report.outcomes[0]?.winningVariant} ${fired.join(",")}`, "winner, hook").toBe("a.r2.v1 a.r2,b");
    expect((got.report.requests ?? []).map((r) => r.customId).join(","), "send order").toBe("a.v1,a.r1.v1,a.r2.v1,b.v1");
    expect("fault" in got.report, "no fault key").toBe(false);
  } finally {
    t.rm();
  }
});

test("§2.2 rows: a non-Error throw; no carry-over without a waiting dependant; the carry-over counts against the cap", async () => {
  const t = tmpRoot("morph-p11c-");
  try {
    for (const id of ["p", "q"]) t.write(`answers/${id}.md`, fenced("MARK_" + id.toUpperCase()));
    const s = await runDeck(input(t, [card("p", grep("MARK_P", "p.ts")), card("q", grep("MARK_Q", "q.ts"))], 1),
      deps(t, recorder([], "q", "boom")));
    expect(`${brief(s.report)} | ${s.report.fault}`, "string thrown, same generation").toBe("p skipped fault 0; q skipped fault 0 | boom");
    expect(s.report.usageTotals.requests, "the generation in flight is lost").toBe(0);

    for (const name of ["a.md", "a.r1.md", "x.md", "y.md"]) t.write("answers/" + name, fenced(name === "x.md" ? "MARK_X" : name === "y.md" ? "MARK_Y" : "none"));
    t.write("answers/a.r2.md", fenced("MARK_A"));
    const old = await runDeck(input(t, [card("a", grep("MARK_A", "a.ts")), card("x", grep("MARK_X", "x.ts")),
      card("y", grep("MARK_Y", "y.ts"), ["x"])], 1), deps(t, recorder([], null, null)));
    expect((old.report.requests ?? []).map((r) => r.customId).join(","), "no waiting dependant: the old order")
      .toBe("a.v1,x.v1,a.r1.v1,y.v1,a.r2.v1");
    expect(brief(old.report), "old outcomes").toBe("a written null 3; x written null 1; y written null 1");

    t.write("answers/b.md", fenced("none"));
    t.write("answers/b.r1.md", fenced("MARK_B"));
    const cap = await runDeck(input(t, [card("a", grep("MARK_A", "a.ts")), card("b", grep("MARK_B", "b.ts"), ["a"])], 1),
      deps(t, recorder([], null, null)));
    expect(brief(cap.report), "the carry-over used generation 1's only batch").toBe("a written null 3; b failed acceptance failed 1");
    expect((cap.report.requests ?? []).map((r) => r.customId).join(","), "cap order").toBe("a.v1,a.r1.v1,a.r2.v1,b.v1");

    const none = await runDeck(input(t, [card("a", grep("MARK_A", "a.ts")), card("b", grep("MARK_B", "b.ts"), ["a"])], 0),
      deps(t, recorder([], null, null)));
    expect(brief(none.report), "cap 0: no retry, b skipped").toBe("a failed acceptance failed 1; b skipped dependency a failed 0");
  } finally {
    t.rm();
  }
});
