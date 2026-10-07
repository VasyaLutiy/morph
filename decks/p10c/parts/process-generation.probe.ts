// P10c probe for process-generation: processGeneration, stageCount and RunDeps.acceptanceTimeoutMs by
// docs/TASK_P10c_runner.md §2.2 (issue #3 C3, C6) — the retry context comes from the variant that got furthest (the most
// "== " stage headers, a tie to the later one), and the acceptance runs under its own timeout (deps.acceptanceTimeoutMs,
// else 300000 ms), never the processor's HTTP timeoutMs. Record Process Generation examples 9-11, then the §2.2 rows and
// the P9b/P9c rules that must hold (examples 4, 5, 8). The harness is the P9b skeleton (paths from probe/<card>/).
import { test, expect, expectTypeOf } from "vitest";
import { processGeneration, stageCount } from "../../src/runloop/generation.js";
import type { Card } from "../../src/cards/types.js";
import type { RunDeps } from "../../src/runloop/types.js";
import { fakeFetch, tmpRoot, type TmpRoot } from "../../tests/helpers.js";

function harness(): { t: TmpRoot; deps: RunDeps; fired: string[] } {
  const t = tmpRoot("morph-p10c-");
  const fired: string[] = [];
  const deps: RunDeps = {
    config: { id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync",
      concurrency: 4, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: t.path("answers") },
    transport: { fetch: fakeFetch().fetch, sleep: async (): Promise<void> => {} },
    commit: (customId, targets) => {
      fired.push(customId);
      return { commit: "sha-" + customId, diffstat: { files: targets.length, insertions: 1, deletions: 0 } };
    },
    now: (): number => 1000,
    env: { PATH: process.env.PATH ?? "" },
  };
  return { t, deps, fired };
}
const fenced = (marker: string): string => '```ts\nexport const x = "' + marker + '";\n```\n';
const card = (customId: string, target: string, acceptance: string, variants = 1): Card => ({ customId, intent: "generate",
  targets: [target], contextSlice: [], instruction: "write " + target, acceptance, model: null, maxTokens: null,
  reasoning: null, variants, dependsOn: [] });
const OLD = 'export const x = "OLD";\n';
const STAGES = "grep -q ONE out/a.ts && { echo '== tsc'; echo '== probe'; echo 'red: one'; exit 1; }; echo '== tsc'; echo 'red: two'; exit 1";
const RED = 'grep -q PASS out/a.ts || { echo "red: $(cat out/a.ts)"; exit 1; }';
const diffTo = (m: string): string =>
  '--- a/out/a.ts\n+++ b/out/a.ts\n@@ -1,1 +1,1 @@\n-export const x = "OLD";\n+export const x = "' + m + '";\n';

test("Process Generation example 9: the context of the variant that got furthest, not the last one", async () => {
  const { t, deps } = harness();
  try {
    t.write("out/a.ts", OLD);
    t.write("answers/a.v1.md", fenced("ONE"));
    t.write("answers/a.v2.md", fenced("TWO"));
    const g = await processGeneration([card("a", "out/a.ts", STAGES, 2)], deps, t.root);
    const o = g.outcomes[0];
    expect(`${o?.status} | ${o?.acceptanceLog} | ${JSON.stringify(o?.earlierFailures)}`, "outcome")
      .toBe('failed | == tsc\nred: two\n | ["== tsc\\n== probe\\nred: one\\n"]');
    expect(g.retryContexts, "retryContexts").toStrictEqual({
      a: { acceptanceOutput: "== tsc\n== probe\nred: one\n", previousDiff: diffTo("ONE") } });
    expect(t.read("out/a.ts"), "rolled back").toBe(OLD);
  } finally {
    t.rm();
  }
});

test("Process Generation example 9: stageCount counts the lines that begin with '== '", () => {
  expect([stageCount("== tsc\n== probe\nred: one\n"), stageCount("== tsc\nred: two\n"), stageCount(""),
    stageCount("a == b\n"), stageCount("x\n== full"), stageCount(" == tsc\n==tsc\n")], "counts").toStrictEqual([2, 1, 0, 0, 1, 0]);
  expectTypeOf(stageCount).toEqualTypeOf<(log: string) => number>();
});

test("Process Generation example 10: the acceptance does not run under the processor's HTTP timeoutMs", async () => {
  const { t, deps } = harness();
  try {
    deps.config.timeoutMs = 100;
    t.write("answers/a.v1.md", fenced("PASS"));
    const g = await processGeneration([card("a", "out/a.ts", "sleep 1; grep -q PASS out/a.ts")], deps, t.root);
    const o = g.outcomes[0];
    expect(`${o?.status} | ${o?.winningVariant} | ${o?.acceptanceLog}`, "outcome").toBe("written | a.v1 | ");
  } finally {
    t.rm();
  }
}, 20000);

test("Process Generation example 11: deps.acceptanceTimeoutMs bounds the acceptance", async () => {
  const { t, deps, fired } = harness();
  try {
    deps.acceptanceTimeoutMs = 200;
    t.write("answers/a.v1.md", fenced("A"));
    const started = Date.now();
    const g = await processGeneration([card("a", "out/a.ts", "sleep 30")], deps, t.root);
    const o = g.outcomes[0];
    expect(`${o?.status} | ${o?.reason}`, "outcome").toBe("failed | acceptance failed");
    expect(o?.acceptanceLog.includes("acceptance timed out after 200 ms"), "log: " + o?.acceptanceLog).toBe(true);
    expect(fired, "commit hook").toStrictEqual([]);
    expect(Date.now() - started < 10000, "returned at once").toBe(true);
  } finally {
    t.rm();
  }
}, 20000);

test("§2.2: RunDeps.acceptanceTimeoutMs is an optional number", () => {
  expectTypeOf<RunDeps["acceptanceTimeoutMs"]>().toEqualTypeOf<number | undefined>();
  const withIt: RunDeps = { ...harness().deps, acceptanceTimeoutMs: 5 };
  expect(withIt.acceptanceTimeoutMs, "settable").toBe(5);
});

test("§2.2: a tie in stages goes to the later variant (Process Generation example 5 holds)", async () => {
  const { t, deps } = harness();
  try {
    t.write("out/a.ts", OLD);
    t.write("answers/a.v1.md", fenced("ONE"));
    t.write("answers/a.v2.md", fenced("TWO"));
    const g = await processGeneration([card("a", "out/a.ts", RED, 2)], deps, t.root);
    expect(g.retryContexts, "retryContexts").toStrictEqual({
      a: { acceptanceOutput: 'red: export const x = "TWO";\n', previousDiff: diffTo("TWO") } });
  } finally {
    t.rm();
  }
});

test("§2.2: a variant that never ran is not chosen, however its log reads (Process Generation example 4 holds)", async () => {
  const { t, deps } = harness();
  try {
    t.write("out/a.ts", OLD);
    t.write("answers/a.v1.md", fenced("ONE"));
    t.write("answers/a.v2.md", "```ts\nexport const x = 2;\n");
    const g = await processGeneration([card("a", "out/a.ts", RED, 2)], deps, t.root);
    expect(g.retryContexts, "retryContexts").toStrictEqual({
      a: { acceptanceOutput: 'red: export const x = "ONE";\n', previousDiff: diffTo("ONE") } });
  } finally {
    t.rm();
  }
});

test("§2.2: the later variant wins a tie even when it reached more stages first (three variants: 1, 2, 2 stages)", async () => {
  const { t, deps } = harness();
  try {
    const acc = "grep -q ONE out/a.ts && { echo '== tsc'; echo one; exit 1; }; echo '== tsc'; echo '== probe'; " +
      "grep -q TWO out/a.ts && { echo two; exit 1; }; echo three; exit 1";
    t.write("out/a.ts", OLD);
    t.write("answers/a.v1.md", fenced("ONE"));
    t.write("answers/a.v2.md", fenced("TWO"));
    t.write("answers/a.v3.md", fenced("THREE"));
    const g = await processGeneration([card("a", "out/a.ts", acc, 3)], deps, t.root);
    expect(g.retryContexts, "retryContexts").toStrictEqual({
      a: { acceptanceOutput: "== tsc\n== probe\nthree\n", previousDiff: diffTo("THREE") } });
  } finally {
    t.rm();
  }
});

test("§2.2: an attempt that changed nothing keeps the empty diff (Process Generation example 8 holds)", async () => {
  const { t, deps } = harness();
  try {
    t.write("out/a.ts", 'export const x = "ONE";\n');
    t.write("answers/a.v1.md", fenced("ONE"));
    const g = await processGeneration([card("a", "out/a.ts", RED)], deps, t.root);
    expect(g.retryContexts, "retryContexts").toStrictEqual({
      a: { acceptanceOutput: 'red: export const x = "ONE";\n', previousDiff: "" } });
  } finally {
    t.rm();
  }
});
