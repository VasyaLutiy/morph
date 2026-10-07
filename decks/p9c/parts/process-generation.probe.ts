// P9c probe for process-generation: processGeneration by docs/TASK_P9c_retry.md §2.2 — a rejected card's
// retry context keeps its diff as Verify Card gave it, "" included (record Process Generation example 8);
// examples 4-6 (P9b, unchanged) guard the rest of the rule. The harness is the P9b skeleton, verbatim
// (paths from probe/<card>/).
import { test, expect } from "vitest";
import { processGeneration } from "../../src/runloop/generation.js";
import type { Card } from "../../src/cards/types.js";
import type { RunDeps } from "../../src/runloop/types.js";
import { fakeFetch, tmpRoot, type TmpRoot } from "../../tests/helpers.js";

function harness(): { t: TmpRoot; deps: RunDeps } {
  const t = tmpRoot("morph-p9c-");
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
const ONE = 'export const x = "ONE";\n';
const RED = 'grep -q PASS out/a.ts || { echo "red: $(cat out/a.ts)"; exit 1; }';
const TRUNCATED = "```ts\nexport const x = 2;\n";
const diffTo = (m: string): string =>
  '--- a/out/a.ts\n+++ b/out/a.ts\n@@ -1,1 +1,1 @@\n-export const x = "OLD";\n+export const x = "' + m + '";\n';

test("Process Generation example 8: an attempt that changed nothing keeps the empty diff, not null", async () => {
  const { t, deps } = harness();
  try {
    t.write("out/a.ts", ONE);
    t.write("answers/a.v1.md", fenced("ONE"));
    const g = await processGeneration([card("a", "out/a.ts", RED)], deps, t.root);
    const o = g.outcomes[0];
    expect(`${o?.status} | ${o?.acceptanceLog}`, "outcome").toBe('failed | red: export const x = "ONE";\n');
    expect(g.retryContexts, "retryContexts").toStrictEqual({
      a: { acceptanceOutput: 'red: export const x = "ONE";\n', previousDiff: "" },
    });
  } finally {
    t.rm();
  }
});

test("Process Generation example 4: the context of the variant that ran, not the truncated last one", async () => {
  const { t, deps } = harness();
  try {
    t.write("out/a.ts", OLD);
    t.write("answers/a.v1.md", fenced("ONE"));
    t.write("answers/a.v2.md", TRUNCATED);
    const g = await processGeneration([card("a", "out/a.ts", RED, 2)], deps, t.root);
    expect(g.retryContexts, "retryContexts").toStrictEqual({
      a: { acceptanceOutput: 'red: export const x = "ONE";\n', previousDiff: diffTo("ONE") },
    });
    expect(t.read("out/a.ts"), "rolled back").toBe(OLD);
  } finally {
    t.rm();
  }
});

test("Process Generation example 5: both variants ran, the last one gives the context", async () => {
  const { t, deps } = harness();
  try {
    t.write("out/a.ts", OLD);
    t.write("answers/a.v1.md", fenced("ONE"));
    t.write("answers/a.v2.md", fenced("TWO"));
    const g = await processGeneration([card("a", "out/a.ts", RED, 2)], deps, t.root);
    expect(g.retryContexts, "retryContexts").toStrictEqual({
      a: { acceptanceOutput: 'red: export const x = "TWO";\n', previousDiff: diffTo("TWO") },
    });
  } finally {
    t.rm();
  }
});

test("Process Generation example 6: null exactly when no acceptance ran", async () => {
  const { t, deps } = harness();
  try {
    t.write("answers/a.v1.md", fenced("MARK_A"));
    t.write("answers/b.v1.md", TRUNCATED);
    const g = await processGeneration([
      card("a", "out/a.ts", "grep -q MARK_A out/a.ts"),
      card("b", "out/b.ts", "grep -q MARK_B out/b.ts"),
      card("c", "out/c.ts", "exit 0", 1, null, ["docs/missing.md"]),
    ], deps, t.root);
    expect(g.retryContexts, "retryContexts").toStrictEqual({
      b: { acceptanceOutput: "answer truncated", previousDiff: null },
      c: { acceptanceOutput: "contextSlice 'docs/missing.md' does not exist", previousDiff: null },
    });
  } finally {
    t.rm();
  }
});

test("§2.2: stale inputs keep previousDiff null", async () => {
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
