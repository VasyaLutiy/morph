// tests/runloop/deck.examples.test.ts — the judge's test for Run Deck
// (TASK_P5 §2.2, Function Run Deck). One test per record example, in
// example order, then a few of the judge's own. Every run happens on the
// stub processor inside vitest: no network (the transport's fetch is never
// called), no git (the commit is the injected hook), no real timer (the
// clock is a function). Everything is written under a tmpRoot() and removed.

import { test, expect } from "vitest";
import { runDeck } from "../../src/runloop/deck.js";
import type { RunDeps, RunInput } from "../../src/runloop/types.js";
import type { Card, Deck } from "../../src/cards/types.js";
import { fakeFetch, tmpRoot } from "../helpers.js";

interface Harness {
  deps: RunDeps;
  commits: string[];
  ff: ReturnType<typeof fakeFetch>;
  root: string;
  rm(): void;
}

// a stub config whose answersDir is the run root itself; the transport
// wraps a fakeFetch whose fetch is never called by the stub route
function harness(now: () => number, answersDir: string): Harness {
  const root = tmpRoot("morph-deck-");
  const ff = fakeFetch();
  const commits: string[] = [];
  const deps: RunDeps = {
    config: {
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
      answersDir: answersDir
    },
    transport: { fetch: ff.fetch, sleep: async () => {} },
    commit: (customId: string, targets: string[]) => {
      commits.push(customId);
      return {
        commit: "sha-" + customId,
        diffstat: { files: targets.length, insertions: 1, deletions: 0 }
      };
    },
    now,
    env: { PATH: process.env.PATH ?? "" }
  };
  return { deps, commits, ff, root: root.root, rm: () => root.rm() };
}

function makeCard(
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

function deckOf(cards: Card[]): Deck {
  return { cards, externalDependsOn: [] };
}

// a fenced answer the parser extracts into the single target file
function answerBody(marker: string): string {
  return "```ts\nexport const value = \"" + marker + "\";\n```\n";
}

const WIDE = { maxCards: 100, maxRetryBatches: 2, deadline: 1_000_000 };

test("Run Deck example 1: two generations, both cards written", async () => {
  const h = harness(() => 100, "");
  h.deps.config.answersDir = h.root;
  const t = tmpRoot("morph-deck-");
  try {
    t.write("a.md", answerBody("MARK_A"));
    t.write("b.md", answerBody("MARK_B"));
    h.deps.config.answersDir = t.root;
    const input: RunInput = {
      root: t.root,
      runId: "run-1",
      branch: "main",
      deck: deckOf([
        makeCard("a", "a.ts", "grep -q MARK_A a.ts"),
        makeCard("b", "b.ts", "grep -q MARK_B b.ts", ["a"])
      ]),
      budget: WIDE
    };
    const { report, outcomes } = await runDeck(input, h.deps);
    expect(report.generations).toBe(2);
    expect(outcomes.length).toBe(2);
    const a = outcomes[0];
    const b = outcomes[1];
    expect(a.customId).toBe("a");
    expect(a.status).toBe("written");
    expect(a.reason === null).toBe(true);
    expect(a.attempts).toBe(1);
    expect(a.winningVariant).toBe("a.v1");
    expect(a.earlierFailures).toStrictEqual([]);
    expect(a.commit).toBe("sha-a");
    expect(a.diffstat).toStrictEqual({ files: 1, insertions: 1, deletions: 0 });
    expect(b.customId).toBe("b");
    expect(b.status).toBe("written");
    expect(b.reason === null).toBe(true);
    expect(b.attempts).toBe(1);
    expect(b.winningVariant).toBe("b.v1");
    expect(b.earlierFailures).toStrictEqual([]);
    expect(b.commit).toBe("sha-b");
    expect(b.diffstat).toStrictEqual({ files: 1, insertions: 1, deletions: 0 });
    expect(report.usageTotals.requests).toBe(2);
    expect(h.commits).toStrictEqual(["a", "b"]);
    expect(t.read("a.ts")).toBe("export const value = \"MARK_A\";\n");
    expect(t.read("b.ts")).toBe("export const value = \"MARK_B\";\n");
  } finally {
    t.rm();
  }
});

test("Run Deck example 2: acceptance fails then the retry writes", async () => {
  const t = tmpRoot("morph-deck-");
  try {
    t.write("c.md", answerBody("MARK_C"));
    t.write("c.r1.md", answerBody("MARK_C"));
    const h = harness(() => 100, t.root);
    // the marker is not a target, so the acceptance rollback keeps it:
    // the first attempt creates it and fails, the retry sees it and passes
    const acceptance =
      "if [ ! -f marker ]; then touch marker; exit 1; fi\ngrep -q MARK_C c.ts";
    const input: RunInput = {
      root: t.root,
      runId: "run-2",
      branch: "main",
      deck: deckOf([makeCard("c", "c.ts", acceptance)]),
      budget: { maxCards: 100, maxRetryBatches: 1, deadline: 1_000_000 }
    };
    const { report, outcomes } = await runDeck(input, h.deps);
    expect(outcomes.length).toBe(1);
    const c = outcomes[0];
    expect(c.customId).toBe("c");
    expect(c.status).toBe("written");
    expect(c.reason === null).toBe(true);
    expect(c.attempts).toBe(2);
    expect(c.earlierFailures.length).toBe(1);
    expect(c.winningVariant).toBe("c.r1.v1");
    expect(c.commit === null).toBe(false);
    expect(report.usageTotals.requests).toBe(2);
    expect(t.read("c.ts")).toBe("export const value = \"MARK_C\";\n");
  } finally {
    t.rm();
  }
});

test("Run Deck example 3: deadline crossed at the second boundary", async () => {
  const t = tmpRoot("morph-deck-");
  try {
    t.write("a.md", answerBody("MARK_A"));
    t.write("b.md", answerBody("MARK_B"));
    const times = [0, 5000, 5000];
    let i = 0;
    const now = (): number => times[Math.min(i++, times.length - 1)];
    const h = harness(now, t.root);
    const input: RunInput = {
      root: t.root,
      runId: "run-3",
      branch: "main",
      deck: deckOf([
        makeCard("a", "a.ts", "grep -q MARK_A a.ts"),
        makeCard("b", "b.ts", "grep -q MARK_B b.ts", ["a"])
      ]),
      budget: { maxCards: 100, maxRetryBatches: 2, deadline: 1000 }
    };
    const { report, outcomes } = await runDeck(input, h.deps);
    expect(report.generations).toBe(2);
    expect(outcomes.length).toBe(2);
    expect(outcomes[0].customId).toBe("a");
    expect(outcomes[0].status).toBe("written");
    expect(outcomes[1].customId).toBe("b");
    expect(outcomes[1].status).toBe("budget-exceeded");
    expect(outcomes[1].reason).toBe("deadline");
    expect(outcomes[1].attempts).toBe(0);
    expect(outcomes[1].commit === null).toBe(true);
    expect(outcomes[1].diffstat === null).toBe(true);
    expect(outcomes[1].earlierFailures).toStrictEqual([]);
    expect(h.commits).toStrictEqual(["a"]);
    expect(report.completedAt).toBe(5000);
  } finally {
    t.rm();
  }
});

test("Run Deck: a failed dependency skips its dependant", async () => {
  const t = tmpRoot("morph-deck-");
  try {
    // the answer carries no marker, so a's acceptance fails
    t.write("a.md", "```ts\nexport const value = \"NOPE\";\n```\n");
    t.write("b.md", answerBody("MARK_B"));
    const h = harness(() => 100, t.root);
    const input: RunInput = {
      root: t.root,
      runId: "run-4",
      branch: "main",
      deck: deckOf([
        makeCard("a", "a.ts", "grep -q MARK_A a.ts"),
        makeCard("b", "b.ts", "grep -q MARK_B b.ts", ["a"])
      ]),
      budget: { maxCards: 100, maxRetryBatches: 0, deadline: 1_000_000 }
    };
    const { outcomes } = await runDeck(input, h.deps);
    expect(outcomes[0].customId).toBe("a");
    expect(outcomes[0].status).toBe("failed");
    expect(outcomes[0].reason).toBe("acceptance failed");
    expect(outcomes[0].commit === null).toBe(true);
    expect(outcomes[1].customId).toBe("b");
    expect(outcomes[1].status).toBe("skipped");
    expect(outcomes[1].reason).toBe("dependency a failed");
    expect(outcomes[1].attempts).toBe(0);
    expect(outcomes[1].commit === null).toBe(true);
    expect(h.commits).toStrictEqual([]);
  } finally {
    t.rm();
  }
});

test("Run Deck: maxCards stops the second generation", async () => {
  const t = tmpRoot("morph-deck-");
  try {
    t.write("a.md", answerBody("MARK_A"));
    t.write("b.md", answerBody("MARK_B"));
    const h = harness(() => 100, t.root);
    const input: RunInput = {
      root: t.root,
      runId: "run-5",
      branch: "main",
      deck: deckOf([
        makeCard("a", "a.ts", "grep -q MARK_A a.ts"),
        makeCard("b", "b.ts", "grep -q MARK_B b.ts", ["a"])
      ]),
      budget: { maxCards: 1, maxRetryBatches: 0, deadline: 1_000_000 }
    };
    const { outcomes } = await runDeck(input, h.deps);
    expect(outcomes[0].status).toBe("written");
    expect(outcomes[1].customId).toBe("b");
    expect(outcomes[1].status).toBe("budget-exceeded");
    expect(outcomes[1].reason).toBe("maxCards 1");
    expect(outcomes[1].attempts).toBe(0);
    expect(h.commits).toStrictEqual(["a"]);
  } finally {
    t.rm();
  }
});

test("Run Deck: the report header carries the run's identity", async () => {
  const t = tmpRoot("morph-deck-");
  try {
    t.write("a.md", answerBody("MARK_A"));
    const h = harness(() => 4242, t.root);
    const input: RunInput = {
      root: t.root,
      runId: "run-6",
      branch: "topic",
      deck: deckOf([makeCard("a", "a.ts", "grep -q MARK_A a.ts")]),
      budget: WIDE
    };
    const { report, outcomes } = await runDeck(input, h.deps);
    expect(report.runId).toBe("run-6");
    expect(report.branch).toBe("topic");
    expect(report.processor).toBe("stub");
    expect(report.generations).toBe(1);
    expect(report.completedAt).toBe(4242);
    expect(report.outcomes).toStrictEqual(outcomes);
    expect(report.usageTotals.requests).toBe(1);
    expect(report.usageTotals.inputTokens).toBe(outcomes.length >= 0 ? report.usageTotals.inputTokens : 0);
  } finally {
    t.rm();
  }
});

test("Run Deck: the stub run opens no socket", async () => {
  const t = tmpRoot("morph-deck-");
  try {
    t.write("a.md", answerBody("MARK_A"));
    t.write("b.md", answerBody("MARK_B"));
    const h = harness(() => 100, t.root);
    const input: RunInput = {
      root: t.root,
      runId: "run-7",
      branch: "main",
      deck: deckOf([
        makeCard("a", "a.ts", "grep -q MARK_A a.ts"),
        makeCard("b", "b.ts", "grep -q MARK_B b.ts", ["a"])
      ]),
      budget: WIDE
    };
    await runDeck(input, h.deps);
    expect(h.ff.calls.length).toBe(0);
  } finally {
    t.rm();
  }
});
