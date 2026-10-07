// tests/runloop/deck.p9b.examples.test.ts — Run Deck examples 4–5 (TASK_P9b §2.3)
// and the §2.2 rows the deck owns: report.requests in send order, the retry
// context threaded by ORIGINAL card id, and the retry after a truncated
// answer (previousDiff null: no diff block in the retry's instruction).

import { expect, test } from "vitest";
import { fakeFetch, tmpRoot } from "../helpers.js";
import { runDeck } from "../../src/runloop/deck.js";
import type { Card } from "../../src/cards/types.js";
import type { ProcessorConfig, Transport } from "../../src/processor/types.js";
import type { RunDeps, RunInput } from "../../src/runloop/types.js";

const CHAT = "https://openrouter.ai/api/v1/chat/completions";
const reply = (content: string): { body: unknown } => ({
  body: {
    id: "gen-1",
    provider: "Novita",
    choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 100, completion_tokens: 20, cost: 0.001 }
  }
});
const fenced = (marker: string): string =>
  '```ts\nexport const x = "' + marker + '";\n```\n';
const truncated = '```ts\nexport const x = "MARK";\n';

function transport(f: ReturnType<typeof fakeFetch>): Transport {
  return { fetch: f.fetch, sleep: async (): Promise<void> => {} };
}

function depsFor(config: ProcessorConfig, f: ReturnType<typeof fakeFetch>): RunDeps {
  return {
    config,
    transport: transport(f),
    commit: (customId, targets) => ({
      commit: "sha-" + customId,
      diffstat: { files: targets.length, insertions: 1, deletions: 0 }
    }),
    now: (): number => 1000,
    env: { PATH: process.env.PATH ?? "" }
  };
}

function input(t: { root: string }, cards: Card[], maxRetryBatches = 1): RunInput {
  return {
    root: t.root,
    runId: "r1",
    branch: "morph/r1",
    deck: { cards, externalDependsOn: [] },
    budget: { maxCards: 10, maxRetryBatches, deadline: 1e15 }
  };
}

function card(
  customId: string,
  target: string,
  acceptance: string,
  dependsOn: string[] = []
): Card {
  return {
    customId,
    intent: "generate",
    targets: [target],
    contextSlice: [],
    instruction: "write " + target,
    acceptance,
    model: null,
    maxTokens: null,
    reasoning: null,
    variants: 1,
    dependsOn
  };
}

const lastMessage = (f: ReturnType<typeof fakeFetch>, i: number): string => {
  const body = JSON.parse(f.calls[i]?.body ?? "{}") as {
    messages?: { content: string }[];
  };
  const ms = body.messages ?? [];
  return ms[ms.length - 1]?.content ?? "";
};

const openrouterConfig: ProcessorConfig = {
  id: "glm",
  type: "openrouter",
  model: "z-ai/glm-5.3",
  apiKey: "k",
  baseUrl: "https://openrouter.ai/api/v1",
  route: "sync",
  concurrency: 1,
  providerOrder: null,
  reasoning: null,
  timeoutMs: 600000,
  maxRetries: 0,
  answersDir: null
};

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
    answersDir
  };
}

test("Run Deck example 4: the retry carries the diff of the failed attempt, and the report rows", async () => {
  const t = tmpRoot("morph-p9b-");
  try {
    const f = fakeFetch({ [CHAT]: reply(fenced("MARK")) });
    const a = card(
      "a",
      "out/a.ts",
      "if [ -f seen ]; then grep -q MARK out/a.ts; else touch seen; echo first-red; exit 1; fi"
    );
    const result = await runDeck(input(t, [a]), depsFor(openrouterConfig, f));

    expect(result.outcomes.length).toBe(1);
    expect(result.outcomes[0]?.status).toBe("written");
    expect(result.outcomes[0]?.attempts).toBe(2);
    expect(result.outcomes[0]?.earlierFailures).toStrictEqual(["first-red\n"]);

    expect(f.calls.length).toBe(2);
    const first = lastMessage(f, 0);
    expect(first.includes("Your previous attempt (rejected)")).toBe(false);
    const second = lastMessage(f, 1);
    expect(second.includes("Acceptance output:\nfirst-red\n")).toBe(true);
    expect(
      second.includes(
        'Your previous attempt (rejected):\n--- /dev/null\n+++ b/out/a.ts\n@@ -0,0 +1,1 @@\n+export const x = "MARK";\n'
      )
    ).toBe(true);

    const row = (customId: string) => ({
      customId,
      model: "z-ai/glm-5.3",
      provider: "Novita",
      generationId: "gen-1",
      inputTokens: 100,
      outputTokens: 20,
      cost: 0.001,
      finishReason: "stop",
      error: null
    });
    expect(result.report.requests).toStrictEqual([row("a.v1"), row("a.r1.v1")]);
    expect(result.report.usageTotals).toStrictEqual({
      inputTokens: 200,
      outputTokens: 40,
      cost: 0.002,
      requests: 2
    });
  } finally {
    t.rm();
  }
});

test("Run Deck example 5: the stub report holds one row per request, both generations in send order", async () => {
  const t = tmpRoot("morph-p9b-");
  try {
    t.write("answers/a.v1.md", fenced("ONE"));
    t.write("answers/b.v1.md", fenced("TWO"));
    const a = card("a", "out/a.ts", "grep -q ONE out/a.ts");
    const b = card("b", "out/b.ts", "grep -q TWO out/b.ts", ["a"]);
    const result = await runDeck(
      input(t, [a, b]),
      depsFor(stubConfig(t.path("answers")), fakeFetch())
    );

    expect(result.outcomes[0]?.status).toBe("written");
    expect(result.outcomes[1]?.status).toBe("written");
    expect(result.report.requests).toStrictEqual([
      {
        customId: "a.v1",
        model: "stub",
        provider: "stub",
        generationId: "stub-a.v1",
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        finishReason: "stop",
        error: null
      },
      {
        customId: "b.v1",
        model: "stub",
        provider: "stub",
        generationId: "stub-b.v1",
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        finishReason: "stop",
        error: null
      }
    ]);
  } finally {
    t.rm();
  }
});

test("Run Deck §2.2: the retry after a truncated answer has no diff block", async () => {
  const t = tmpRoot("morph-p9b-");
  try {
    const f = fakeFetch({ [CHAT]: reply(truncated) });
    const a = card("a", "out/a.ts", "grep -q MARK out/a.ts");
    const result = await runDeck(input(t, [a]), depsFor(openrouterConfig, f));

    expect(result.outcomes.length).toBe(1);
    expect(result.outcomes[0]?.status).toBe("failed");
    expect(result.outcomes[0]?.attempts).toBe(2);
    expect(result.outcomes[0]?.acceptanceLog).toBe("answer truncated");
    expect(result.outcomes[0]?.earlierFailures).toStrictEqual(["answer truncated"]);

    expect(f.calls.length).toBe(2);
    const second = lastMessage(f, 1);
    expect(second.includes("Acceptance output:\nanswer truncated")).toBe(true);
    // the P5 header "Your previous attempt failed its acceptance." is there,
    // but the diff block and its closing sentence are not (previousDiff null)
    expect(second.includes("Your previous attempt (rejected)")).toBe(false);
    expect(second.includes("--- /dev/null")).toBe(false);
    expect(
      second.includes("The diff above is your own previous edit")
    ).toBe(false);

    expect(result.report.requests?.length).toBe(2);
    expect(result.report.requests?.[1]?.customId).toBe("a.r1.v1");
  } finally {
    t.rm();
  }
});

test("Run Deck §2.2: a card that passes at once adds exactly one request row and no retry", async () => {
  const t = tmpRoot("morph-p9b-");
  try {
    const f = fakeFetch({ [CHAT]: reply(fenced("MARK")) });
    const a = card("a", "out/a.ts", "grep -q MARK out/a.ts");
    const result = await runDeck(input(t, [a]), depsFor(openrouterConfig, f));

    expect(result.outcomes[0]?.status).toBe("written");
    expect(result.outcomes[0]?.attempts).toBe(1);
    expect(f.calls.length).toBe(1);
    expect(result.report.requests?.map((r) => r.customId)).toStrictEqual(["a.v1"]);
    expect(result.report.usageTotals).toStrictEqual({
      inputTokens: 100,
      outputTokens: 20,
      cost: 0.001,
      requests: 1
    });
  } finally {
    t.rm();
  }
});
