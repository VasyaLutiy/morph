
import { expect, test } from "vitest";
import { fakeFetch, tmpRoot, type TmpRoot } from "../helpers.js";
import type { Card } from "../../src/cards/types.js";
import type { RunDeps } from "../../src/runloop/types.js";
import { processGeneration } from "../../src/runloop/generation.js";
import { TRUNCATED_RESPONSE_MESSAGE } from "../../src/acceptance/verify.js";

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

const GREP = 'grep -q PASS out/a.ts || { echo "red: $(cat out/a.ts)"; exit 1; }';

test("Process Generation example 4: the context of the variant that ran, not the last one", async () => {
  const { t, deps } = harness();
  try {
    t.write("out/a.ts", 'export const x = "OLD";\n');
    t.write("answers/a.v1.md", fenced("ONE"));
    t.write("answers/a.v2.md", '```ts\nexport const x = 2;\n');
    const g = await processGeneration([card("a", "out/a.ts", GREP, 2)], deps, t.root);
    expect(g.outcomes).toStrictEqual([{
      customId: "a", status: "failed", reason: "acceptance failed", attempts: 1,
      winningVariant: null, acceptanceLog: TRUNCATED_RESPONSE_MESSAGE,
      earlierFailures: ['red: export const x = "ONE";\n'],
      commit: null, diffstat: null
    }]);
    expect(g.retryContexts).toStrictEqual({
      a: {
        acceptanceOutput: 'red: export const x = "ONE";\n',
        previousDiff: '--- a/out/a.ts\n+++ b/out/a.ts\n@@ -1,1 +1,1 @@\n-export const x = "OLD";\n+export const x = "ONE";\n'
      }
    });
    expect(t.read("out/a.ts")).toBe('export const x = "OLD";\n');
  } finally {
    t.rm();
  }
});

test("Process Generation example 5: both variants ran, the last one gives the context", async () => {
  const { t, deps } = harness();
  try {
    t.write("out/a.ts", 'export const x = "OLD";\n');
    t.write("answers/a.v1.md", fenced("ONE"));
    t.write("answers/a.v2.md", fenced("TWO"));
    const g = await processGeneration([card("a", "out/a.ts", GREP, 2)], deps, t.root);
    expect(g.outcomes).toStrictEqual([{
      customId: "a", status: "failed", reason: "acceptance failed", attempts: 1,
      winningVariant: null, acceptanceLog: 'red: export const x = "TWO";\n',
      earlierFailures: ['red: export const x = "ONE";\n'],
      commit: null, diffstat: null
    }]);
    expect(g.retryContexts).toStrictEqual({
      a: {
        acceptanceOutput: 'red: export const x = "TWO";\n',
        previousDiff: '--- a/out/a.ts\n+++ b/out/a.ts\n@@ -1,1 +1,1 @@\n-export const x = "OLD";\n+export const x = "TWO";\n'
      }
    });
  } finally {
    t.rm();
  }
});

test("Process Generation example 6: contexts for a truncated answer and a compile fault, none for a written card", async () => {
  const { t, deps } = harness();
  try {
    t.write("answers/a.v1.md", fenced("MARK"));
    t.write("answers/b.v1.md", '```ts\nexport const x = 2;\n');
    t.write("answers/c.v1.md", fenced("MARK"));
    const cards = [
      card("a", "out/a.ts", "grep -q MARK out/a.ts"),
      card("b", "out/b.ts", "grep -q MARK out/b.ts"),
      card("c", "out/c.ts", "grep -q MARK out/c.ts", 1, null, ["docs/missing.md"])
    ];
    const g = await processGeneration(cards, deps, t.root);
    expect(g.outcomes.map((o) => o.status)).toStrictEqual(["written", "failed", "failed"]);
    expect(g.retryContexts).toStrictEqual({
      b: { acceptanceOutput: TRUNCATED_RESPONSE_MESSAGE, previousDiff: null },
      c: { acceptanceOutput: "contextSlice 'docs/missing.md' does not exist", previousDiff: null }
    });
  } finally {
    t.rm();
  }
});

test("Process Generation example 7: one usage row per request in send order, the model of the request", async () => {
  const { t, deps } = harness();
  try {
    t.write("answers/a.v1.md", fenced("MARK"));
    t.write("answers/b.v1.md", fenced("MARK"));
    const cards = [
      card("a", "out/a.ts", "grep -q MARK out/a.ts"),
      card("b", "out/b.ts", "grep -q MARK out/b.ts", 1, "glm-x")
    ];
    const g = await processGeneration(cards, deps, t.root);
    expect(g.requests).toStrictEqual([
      { customId: "a.v1", model: "stub", provider: "stub", generationId: "stub-a.v1",
        inputTokens: 0, outputTokens: 0, cost: 0, finishReason: "stop", error: null },
      { customId: "b.v1", model: "glm-x", provider: "stub", generationId: "stub-b.v1",
        inputTokens: 0, outputTokens: 0, cost: 0, finishReason: "stop", error: null }
    ]);
    expect(g.retryContexts).toStrictEqual({});
  } finally {
    t.rm();
  }
});

test("Process Generation own: a stale card's context carries the stale log and no diff", async () => {
  const { t, deps } = harness();
  try {
    t.write("shared.ts", "one\n");
    t.write("answers/a.v1.md", fenced("MARK"));
    t.write("answers/b.v1.md", fenced("TWO"));
    const cards = [
      card("a", "shared.ts", "grep -q MARK shared.ts"),
      { ...card("b", "out/b.ts", "grep -q TWO out/b.ts"), contextSlice: ["shared.ts"] }
    ];
    const g = await processGeneration(cards, deps, t.root);
    expect(g.outcomes[1]?.status).toBe("failed");
    expect(g.outcomes[1]?.reason).toBe("stale inputs");
    expect(g.retryContexts).toStrictEqual({
      b: { acceptanceOutput: "stale inputs: shared.ts", previousDiff: null }
    });
  } finally {
    t.rm();
  }
});

test("Process Generation example 8: the acceptance ran on an attempt that changed nothing (empty diff, not null)", async () => {
  const { t, deps } = harness();
  try {
    t.write("out/a.ts", 'export const x = "ONE";\n');
    t.write("answers/a.v1.md", fenced("ONE"));
    const g = await processGeneration([card("a", "out/a.ts", GREP)], deps, t.root);
    expect(g.outcomes[0]?.acceptanceLog).toBe('red: export const x = "ONE";\n');
    expect(g.retryContexts).toStrictEqual({
      a: { acceptanceOutput: 'red: export const x = "ONE";\n', previousDiff: "" }
    });
  } finally {
    t.rm();
  }
});

test("Process Generation own: a variant card's rows follow the send order", async () => {
  const { t, deps } = harness();
  try {
    t.write("out/a.ts", 'export const x = "OLD";\n');
    t.write("answers/a.v1.md", fenced("ONE"));
    t.write("answers/a.v2.md", fenced("TWO"));
    const g = await processGeneration([card("a", "out/a.ts", GREP, 2)], deps, t.root);
    expect(g.requests.map((r) => r.customId)).toStrictEqual(["a.v1", "a.v2"]);
    expect(g.usage).toHaveLength(2);
  } finally {
    t.rm();
  }
});
