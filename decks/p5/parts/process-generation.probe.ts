// P5 probe for process-generation: processGeneration by docs/TASK_P5_runloop.md §2.2, one test
// per record example (Component runloop, Function Process Generation), then a §2.2 row. The
// processor is the stub (no network); verifyCard owns the only child process; the commit hook is
// a recording stand-in for P6 git.
import { test, expect } from "vitest";
import { processGeneration } from "../../src/runloop/generation.js";
import type { Card } from "../../src/cards/types.js";
import type { CardOutcome, CommitHook, RunDeps } from "../../src/runloop/types.js";
import type { ProcessorConfig, Transport, Usage } from "../../src/processor/types.js";
import { fakeFetch, tmpRoot } from "../../tests/helpers.js";

const block = (marker: string): string => '```ts\nexport const x = "' + marker + '";\n```\n';

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
    answersDir,
  };
}
function transport(): Transport {
  const ff = fakeFetch();
  return { fetch: ff.fetch, sleep: async (): Promise<void> => {} };
}
function deps(answersDir: string, commits: string[]): RunDeps {
  const commit: CommitHook = (customId, targets) => {
    commits.push(customId);
    return { commit: "sha-" + customId, diffstat: { files: targets.length, insertions: 1, deletions: 0 } };
  };
  return { config: stubConfig(answersDir), transport: transport(), commit, now: (): number => 1000, env: { PATH: process.env.PATH ?? "" } };
}
const card = (customId: string, target: string, acceptance: string, contextSlice: string[] = []): Card => ({
  customId,
  intent: "generate",
  targets: [target],
  contextSlice,
  instruction: "x",
  acceptance,
  model: null,
  maxTokens: null,
  reasoning: null,
  variants: 1,
  dependsOn: [],
});
const byId = (os: CardOutcome[]): Record<string, CardOutcome> => Object.fromEntries(os.map((o) => [o.customId, o]));

test("Process Generation example 1: two stub cards accepted, commit hook per card", async () => {
  const r = tmpRoot();
  try {
    r.write("ans/a.v1.md", block("MARK_A"));
    r.write("ans/b.v1.md", block("MARK_B"));
    const commits: string[] = [];
    const g = await processGeneration(
      [card("a", "out/a.ts", "grep -q MARK_A out/a.ts"), card("b", "out/b.ts", "grep -q MARK_B out/b.ts")],
      deps(r.path("ans"), commits),
      r.root,
    );
    expect(
      g.outcomes.map((o) => `${o.customId} ${o.status} ${o.winningVariant} ${o.attempts}`).join(" | "),
      "both written",
    ).toBe("a written a.v1 1 | b written b.v1 1");
    expect(commits.join(","), "commit hook per card").toBe("a,b");
    expect(g.outcomes[0]?.commit, "commit sha").toBe("sha-a");
    expect(g.outcomes[0]?.diffstat, "diffstat").toStrictEqual({ files: 1, insertions: 1, deletions: 0 });
    expect(g.outcomes[0]?.reason === null, "reason null on written").toBe(true);
    expect(g.usage.length, "usage per request").toBe(2);
    expect(g.usage.every((u: Usage) => u.provider === "stub"), "stub usage").toBe(true);
    expect(r.read("out/a.ts").includes("MARK_A"), "file written and kept").toBe(true);
  } finally {
    r.rm();
  }
});

test("Process Generation example 2: a card that fails its acceptance", async () => {
  const r = tmpRoot();
  try {
    r.write("ans/a.v1.md", block("MARK_A"));
    const commits: string[] = [];
    const g = await processGeneration([card("a", "out/a.ts", "exit 1")], deps(r.path("ans"), commits), r.root);
    const o = g.outcomes[0];
    expect(`${o?.status} ${o?.reason} ${o?.winningVariant}`, "failed").toBe("failed acceptance failed null");
    expect(o?.commit === null, "no commit").toBe(true);
    expect(commits.length, "hook not fired").toBe(0);
  } finally {
    r.rm();
  }
});

test("Process Generation example 3: a sibling's write makes the next card's inputs stale", async () => {
  const r = tmpRoot();
  try {
    r.write("shared.ts", 'export const s = "OLD";\n');
    r.write("ans/a.v1.md", '```ts\nexport const s = "NEW";\n```\n');
    r.write("ans/b.v1.md", block("MARK_B"));
    const commits: string[] = [];
    const a: Card = { ...card("a", "shared.ts", "grep -q NEW shared.ts"), intent: "patch" };
    const b = card("b", "out/b.ts", "grep -q MARK_B out/b.ts", ["shared.ts"]);
    const g = await processGeneration([a, b], deps(r.path("ans"), commits), r.root);
    const m = byId(g.outcomes);
    expect(m["a"]?.status, "a written").toBe("written");
    expect(`${m["b"]?.status} ${m["b"]?.reason}`, "b stale").toBe("failed stale inputs");
    expect(m["b"]?.acceptanceLog.startsWith("stale inputs: shared.ts"), "stale log").toBe(true);
    expect(commits.join(","), "only a committed").toBe("a");
  } finally {
    r.rm();
  }
});

test("§2.2 row: a compile fault discards the card before any send", async () => {
  const r = tmpRoot();
  try {
    const commits: string[] = [];
    const bad = card("a", "out/a.ts", "exit 0", ["missing/slice.ts"]);
    const g = await processGeneration([bad], deps(r.path("ans"), commits), r.root);
    const o = g.outcomes[0];
    expect(o?.status, "failed").toBe("failed");
    expect(o?.reason?.startsWith("compile: "), "compile reason").toBe(true);
    expect(o?.acceptanceLog.includes("does not exist"), "fault in log").toBe(true);
    expect(g.usage.length, "no request sent").toBe(0);
    expect(commits.length, "hook not fired").toBe(0);
  } finally {
    r.rm();
  }
});
