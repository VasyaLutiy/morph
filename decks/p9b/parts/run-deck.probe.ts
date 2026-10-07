// P9b probe for run-deck: runDeck by docs/TASK_P9b_runloop.md §2.2, one test per NEW record example
// (Component runloop, Function Run Deck, examples 4-5; 1-3 stay pinned by tests/runloop/deck.examples.test.ts),
// then the §2.2 rows: a second retry carries the first retry's context, a truncated attempt sends no
// diff block. The harness is the skeleton of §2.1 (paths from probe/<card>/).
import { test, expect } from "vitest";
import { runDeck } from "../../src/runloop/deck.js";
import type { Card } from "../../src/cards/types.js";
import type { ProcessorConfig } from "../../src/processor/types.js";
import type { RequestUsage, RunDeps, RunInput } from "../../src/runloop/types.js";
import { fakeFetch, tmpRoot } from "../../tests/helpers.js";

const CHAT = "https://openrouter.ai/api/v1/chat/completions";
const fenced = (marker: string): string => '```ts\nexport const x = "' + marker + '";\n```\n';
const card = (customId: string, target: string, acceptance: string, dependsOn: string[] = []): Card => ({ customId,
  intent: "generate", targets: [target], contextSlice: [], instruction: "write " + target, acceptance, model: null,
  maxTokens: null, reasoning: null, variants: 1, dependsOn });
const config = (type: "stub" | "openrouter", answersDir: string | null): ProcessorConfig => ({ id: type === "stub" ? "stub" : "glm",
  type, model: type === "stub" ? "stub" : "z-ai/glm-5.3", apiKey: type === "stub" ? null : "k", baseUrl: "https://openrouter.ai/api/v1",
  route: "sync", concurrency: 1, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir });
const reply = (content: string): { body: unknown } => ({ body: { id: "gen-1", provider: "Novita",
  choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
  usage: { prompt_tokens: 100, completion_tokens: 20, cost: 0.001 } } });
const input = (root: string, cards: Card[], maxRetryBatches: number): RunInput => ({ root, runId: "r1", branch: "morph/r1",
  deck: { cards, externalDependsOn: [] }, budget: { maxCards: 10, maxRetryBatches, deadline: 1e15 } });
const deps = (cfg: ProcessorConfig, f: ReturnType<typeof fakeFetch>): RunDeps => ({ config: cfg,
  transport: { fetch: f.fetch, sleep: async (): Promise<void> => {} },
  commit: (customId, targets) => ({ commit: "sha-" + customId, diffstat: { files: targets.length, insertions: 1, deletions: 0 } }),
  now: (): number => 1000, env: { PATH: process.env.PATH ?? "" } });
const lastMessage = (f: ReturnType<typeof fakeFetch>, i: number): string => {
  const body = JSON.parse(f.calls[i]?.body ?? "{}") as { messages?: { content: string }[] };
  const ms = body.messages ?? [];
  return ms[ms.length - 1]?.content ?? "";
};
const SEEN = "if [ -f seen ]; then grep -q MARK out/a.ts; else touch seen; echo first-red; exit 1; fi";
const glmRow = (customId: string): RequestUsage => ({ customId, model: "z-ai/glm-5.3", provider: "Novita", generationId: "gen-1",
  inputTokens: 100, outputTokens: 20, cost: 0.001, finishReason: "stop", error: null });
const stubRow = (customId: string): RequestUsage => ({ customId, model: "stub", provider: "stub", generationId: "stub-" + customId,
  inputTokens: 0, outputTokens: 0, cost: 0, finishReason: "stop", error: null });

test("Run Deck example 4: the retry request carries the failed attempt's output and diff; one usage row per request", async () => {
  const t = tmpRoot("morph-p9b-");
  try {
    const f = fakeFetch({ [CHAT]: reply(fenced("MARK")) });
    const { report, outcomes } = await runDeck(input(t.root, [card("a", "out/a.ts", SEEN)], 1), deps(config("openrouter", null), f));
    const a = outcomes[0];
    expect(`${a?.status} ${a?.attempts}`, "a written on the retry").toBe("written 2");
    expect(a?.earlierFailures, "earlierFailures").toStrictEqual(["first-red\n"]);
    expect(f.calls.length, "two fetch calls").toBe(2);
    expect(lastMessage(f, 0).includes("Your previous attempt"), "first call has no retry block").toBe(false);
    expect(lastMessage(f, 1).includes("Acceptance output:\nfirst-red\n"), "retry carries the output").toBe(true);
    expect(lastMessage(f, 1).includes(
      'Your previous attempt (rejected):\n--- /dev/null\n+++ b/out/a.ts\n@@ -0,0 +1,1 @@\n+export const x = "MARK";\n'),
    "retry carries the diff").toBe(true);
    expect(report.requests, "report.requests").toStrictEqual([glmRow("a.v1"), glmRow("a.r1.v1")]);
    expect(report.usageTotals, "usageTotals").toStrictEqual({ inputTokens: 200, outputTokens: 40, cost: 0.002, requests: 2 });
  } finally {
    t.rm();
  }
});

test("Run Deck example 5: report.requests holds the rows of every generation in send order", async () => {
  const t = tmpRoot("morph-p9b-");
  try {
    t.write("answers/a.v1.md", fenced("MARK_A"));
    t.write("answers/b.v1.md", fenced("MARK_B"));
    const cards = [card("a", "out/a.ts", "grep -q MARK_A out/a.ts"), card("b", "out/b.ts", "grep -q MARK_B out/b.ts", ["a"])];
    const { report } = await runDeck(input(t.root, cards, 1), deps(config("stub", t.path("answers")), fakeFetch()));
    expect(report.generations, "generations").toBe(2);
    expect(report.requests, "report.requests").toStrictEqual([stubRow("a.v1"), stubRow("b.v1")]);
  } finally {
    t.rm();
  }
});

test("§2.2: the retry after a truncated answer has no diff block", async () => {
  const t = tmpRoot("morph-p9b-");
  try {
    const f = fakeFetch({ [CHAT]: reply("```ts\nexport const x = 1;\n") });
    const { outcomes } = await runDeck(input(t.root, [card("a", "out/a.ts", "exit 1")], 1), deps(config("openrouter", null), f));
    expect(outcomes[0]?.status, "failed").toBe("failed");
    expect(lastMessage(f, 1).includes("Acceptance output:\nanswer truncated\n\n"), "the output").toBe(true);
    expect(lastMessage(f, 1).includes("Your previous attempt (rejected)"), "no diff block").toBe(false);
  } finally {
    t.rm();
  }
});

test("§2.2: the second retry's request carries the first retry's attempt, not the first attempt's", async () => {
  const t = tmpRoot("morph-p9b-");
  try {
    const f = fakeFetch();
    let n = 0;
    const counting: ReturnType<typeof fakeFetch> = { ...f, fetch: (url, init) => {
      n += 1;
      f.set(CHAT, reply(fenced(n === 1 ? "ONE" : "TWO")));
      return f.fetch(url, init);
    } };
    const red = 'grep -q PASS out/a.ts || { echo "red: $(cat out/a.ts)"; exit 1; }';
    const { outcomes } = await runDeck(input(t.root, [card("a", "out/a.ts", red)], 2), deps(config("openrouter", null), counting));
    expect(`${outcomes[0]?.status} ${outcomes[0]?.attempts}`, "failed after two retries").toBe("failed 3");
    expect(f.calls.length, "three calls").toBe(3);
    expect(lastMessage(f, 1).includes('Acceptance output:\nred: export const x = "ONE";\n'), "r1 gets attempt 0").toBe(true);
    expect(lastMessage(f, 2).includes('Acceptance output:\nred: export const x = "TWO";\n'), "r2 gets r1's output").toBe(true);
    expect(lastMessage(f, 2).includes('+export const x = "TWO";\n'), "r2 gets r1's diff").toBe(true);
    expect(lastMessage(f, 2).includes('"ONE"'), "nothing of attempt 0 in r2").toBe(false);
  } finally {
    t.rm();
  }
});
