// P9b probe for process-generation: processGeneration by docs/TASK_P9b_runloop.md §2.2, one test per
// NEW record example (Component runloop, Function Process Generation, examples 4-7; 1-3 stay pinned by
// tests/runloop/generation.examples.test.ts), then the §2.2 rows: the retry context of a stale card,
// an empty diff, and the types. The harness is the skeleton of §2.1, verbatim (paths from probe/<card>/).
import { test, expect } from "vitest";
import { processGeneration } from "../../src/runloop/generation.js";
import type { Card } from "../../src/cards/types.js";
import type { GenerationOutcome, RequestUsage, RetryContext, RunDeps } from "../../src/runloop/types.js";
import { fakeFetch, tmpRoot, type TmpRoot } from "../../tests/helpers.js";

function harness(): { t: TmpRoot; deps: RunDeps } {
  const t = tmpRoot("morph-p9b-");
  const deps: RunDeps = {
    config: { id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync",
      concurrency: 4, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: t.path("answers") },
    transport: { fetch: fakeFetch().fetch, sleep: async (): Promise<void> => {} },
    commit: (customId, targets) => ({ commit: "sha-" + customId, diffstat: { files: targets.length, insertions: 1, deletions: 0 } }),
    now: (): number => 1000,
    env: { PATH: process.env.PATH ?? "" },
  };
  return { t, deps };
}
const fenced = (marker: string): string => '```ts\nexport const x = "' + marker + '";\n```\n';
const card = (customId: string, target: string, acceptance: string, variants = 1, model: string | null = null,
  contextSlice: string[] = []): Card => ({ customId, intent: "generate", targets: [target], contextSlice,
  instruction: "write " + target, acceptance, model, maxTokens: null, reasoning: null, variants, dependsOn: [] });

const OLD = 'export const x = "OLD";\n';
const RED = 'grep -q PASS out/a.ts || { echo "red: $(cat out/a.ts)"; exit 1; }';
const TRUNCATED = "```ts\nexport const x = 2;\n";
const diffTo = (m: string): string =>
  '--- a/out/a.ts\n+++ b/out/a.ts\n@@ -1,1 +1,1 @@\n-export const x = "OLD";\n+export const x = "' + m + '";\n';
const row = (customId: string, model: string): RequestUsage => ({ customId, model, provider: "stub",
  generationId: "stub-" + customId, inputTokens: 0, outputTokens: 0, cost: 0, finishReason: "stop", error: null });

test("Process Generation example 4: the retry context comes from the variant that ran, not the truncated last one", async () => {
  const { t, deps } = harness();
  try {
    t.write("out/a.ts", OLD);
    t.write("answers/a.v1.md", fenced("ONE"));
    t.write("answers/a.v2.md", TRUNCATED);
    const g = await processGeneration([card("a", "out/a.ts", RED, 2)], deps, t.root);
    const o = g.outcomes[0];
    expect(`${o?.status} | ${o?.reason} | ${o?.acceptanceLog}`, "outcome").toBe("failed | acceptance failed | answer truncated");
    expect(o?.earlierFailures, "earlierFailures").toStrictEqual(['red: export const x = "ONE";\n']);
    expect(g.retryContexts, "retryContexts").toStrictEqual({
      a: { acceptanceOutput: 'red: export const x = "ONE";\n', previousDiff: diffTo("ONE") },
    });
    expect(t.read("out/a.ts"), "rolled back").toBe(OLD);
  } finally {
    t.rm();
  }
});

test("Process Generation example 5: both variants ran, the retry context is the last one's", async () => {
  const { t, deps } = harness();
  try {
    t.write("out/a.ts", OLD);
    t.write("answers/a.v1.md", fenced("ONE"));
    t.write("answers/a.v2.md", fenced("TWO"));
    const g = await processGeneration([card("a", "out/a.ts", RED, 2)], deps, t.root);
    const o = g.outcomes[0];
    expect(`${o?.status} | ${o?.acceptanceLog}`, "outcome").toBe('failed | red: export const x = "TWO";\n');
    expect(o?.earlierFailures, "earlierFailures").toStrictEqual(['red: export const x = "ONE";\n']);
    expect(g.retryContexts, "retryContexts").toStrictEqual({
      a: { acceptanceOutput: 'red: export const x = "TWO";\n', previousDiff: diffTo("TWO") },
    });
  } finally {
    t.rm();
  }
});

test("Process Generation example 6: a context per failed card only; no diff when nothing ran", async () => {
  const { t, deps } = harness();
  try {
    t.write("answers/a.v1.md", fenced("MARK_A"));
    t.write("answers/b.v1.md", TRUNCATED);
    const g = await processGeneration([
      card("a", "out/a.ts", "grep -q MARK_A out/a.ts"),
      card("b", "out/b.ts", "grep -q MARK_B out/b.ts"),
      card("c", "out/c.ts", "exit 0", 1, null, ["docs/missing.md"]),
    ], deps, t.root);
    expect(g.outcomes.map((o) => o.status).join(","), "statuses").toBe("written,failed,failed");
    expect(g.retryContexts, "retryContexts").toStrictEqual({
      b: { acceptanceOutput: "answer truncated", previousDiff: null },
      c: { acceptanceOutput: "contextSlice 'docs/missing.md' does not exist", previousDiff: null },
    });
  } finally {
    t.rm();
  }
});

test("Process Generation example 7: one Request Usage row per request, model from the request or the config", async () => {
  const { t, deps } = harness();
  try {
    t.write("answers/a.v1.md", fenced("MARK_A"));
    t.write("answers/b.v1.md", fenced("MARK_B"));
    const g = await processGeneration([
      card("a", "out/a.ts", "grep -q MARK_A out/a.ts"),
      card("b", "out/b.ts", "grep -q MARK_B out/b.ts", 1, "glm-x"),
    ], deps, t.root);
    expect(g.requests, "requests").toStrictEqual([row("a.v1", "stub"), row("b.v1", "glm-x")]);
    expect(g.retryContexts, "retryContexts").toStrictEqual({});
  } finally {
    t.rm();
  }
});

test("§2.2: stale inputs give a context with the stale log and no diff", async () => {
  const { t, deps } = harness();
  try {
    t.write("shared.ts", "export const s = 0;\n");
    t.write("answers/a.v1.md", fenced("MARK_A"));
    t.write("answers/b.v1.md", fenced("MARK_B"));
    const g = await processGeneration([
      card("a", "shared.ts", "grep -q MARK_A shared.ts"),
      card("b", "out/b.ts", "grep -q MARK_B out/b.ts", 1, null, ["shared.ts"]),
    ], deps, t.root);
    expect(g.retryContexts, "retryContexts").toStrictEqual({
      b: { acceptanceOutput: "stale inputs: shared.ts", previousDiff: null },
    });
  } finally {
    t.rm();
  }
});

test("§2.2: an attempt that changed nothing gives previousDiff null with its own log", async () => {
  const { t, deps } = harness();
  try {
    t.write("out/a.ts", OLD);
    t.write("answers/a.v1.md", fenced("OLD"));
    const g = await processGeneration([card("a", "out/a.ts", RED)], deps, t.root);
    expect(g.retryContexts, "retryContexts").toStrictEqual({
      a: { acceptanceOutput: 'red: export const x = "OLD";\n', previousDiff: null },
    });
  } finally {
    t.rm();
  }
});

test("§2.2: the types of GenerationOutcome, RequestUsage and RetryContext", () => {
  const ctx: RetryContext = { acceptanceOutput: "x", previousDiff: null };
  const r: RequestUsage = row("a.v1", "stub");
  const g: GenerationOutcome = { outcomes: [], usage: [], requests: [r], retryContexts: { a: ctx } };
  expect(Object.keys(g).join(","), "GenerationOutcome keys").toBe("outcomes,usage,requests,retryContexts");
});
