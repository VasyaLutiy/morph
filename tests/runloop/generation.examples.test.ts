// tests/runloop/generation.examples.test.ts — the judge's test for Process Generation
// (docs/TASK_P5_runloop.md §2.2, Component runloop, Function Process Generation): one test
// per record example in example order, then the judge's own tests on the §2.2 rows. Every
// generation runs on the stub processor: the transport wraps a fakeFetch whose fetch is never
// called, the clock is a constant, the commit is a recording hook, and verifyCard owns the
// only child process. Everything is written under one tmpRoot() — the run root, with the stub
// answers in its "answers" subdirectory — and removed at the end of the test.

import { test, expect } from "vitest";
import { processGeneration } from "../../src/runloop/generation.js";
import type { CardOutcome, CommitHook, RunDeps } from "../../src/runloop/types.js";
import type { Usage } from "../../src/processor/types.js";
import type { Card, Intent } from "../../src/cards/types.js";
import { fakeFetch, tmpRoot } from "../helpers.js";

interface Fired {
  customId: string;
  targets: string[];
}

interface Harness {
  root: string;
  deps: RunDeps;
  fired: Fired[]; // every (customId, targets) the commit hook was fired with, in order
  socketCalls(): number; // calls on the transport's fetch: always 0 on the stub route
  answer(requestId: string, text: string): void; // the stub answer answers/<requestId>.md
  write(rel: string, text: string): void;
  read(rel: string): string;
  exists(rel: string): boolean;
  rm(): void;
}

// The §2.1 deps: a stub config whose answersDir is a subdirectory of the run root, a
// transport over fakeFetch with a sleep that resolves at once, the recording commit hook of
// §2.1 (sha-<id>, diffstat files = targets.length), a constant clock and an env carrying PATH
// for the acceptance shell. With nullCommit the hook still records but returns null.
function harness(nullCommit = false): Harness {
  const t = tmpRoot("morph-generation-");
  const ff = fakeFetch();
  const fired: Fired[] = [];
  const commit: CommitHook = (customId, targets) => {
    fired.push({ customId, targets: [...targets] });
    if (nullCommit) return null;
    return {
      commit: "sha-" + customId,
      diffstat: { files: targets.length, insertions: 1, deletions: 0 },
    };
  };
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
      answersDir: t.path("answers"),
    },
    transport: { fetch: ff.fetch, sleep: async (): Promise<void> => {} },
    commit,
    now: (): number => 1000,
    env: { PATH: process.env.PATH ?? "" },
  };
  return {
    root: t.root,
    deps,
    fired,
    socketCalls: (): number => ff.calls.length,
    answer: (requestId: string, text: string): void => {
      t.write("answers/" + requestId + ".md", text);
    },
    write: (rel: string, text: string): void => {
      t.write(rel, text);
    },
    read: (rel: string): string => t.read(rel),
    exists: (rel: string): boolean => t.exists(rel),
    rm: (): void => t.rm(),
  };
}

// A card with every field set (§2.1: no defaults are applied in the run loop).
function card(
  customId: string,
  targets: string[],
  acceptance: string | null,
  contextSlice: string[] = [],
  variants = 1,
  intent: Intent = "generate",
): Card {
  return {
    customId,
    intent,
    targets,
    contextSlice,
    instruction: "write " + targets.join(" and "),
    acceptance,
    model: null,
    maxTokens: null,
    reasoning: null,
    variants,
    dependsOn: [],
  };
}

// A stub answer whose body is one fenced ts block, so parseAnswer (one target) extracts
// exactly fileOf(marker) into the target file.
function fenced(marker: string): string {
  return "```ts\n" + fileOf(marker) + "```\n";
}

function fileOf(marker: string): string {
  return 'export const x = "' + marker + '";\n';
}

// The usage row the stub processor reports for one request (provider "stub").
function stubUsage(customId: string): Usage {
  return {
    customId,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    provider: "stub",
    generationId: "stub-" + customId,
  };
}

// The accepted outcome of §2.2 step 3 under the §2.1 commit hook.
function written(
  customId: string,
  winningVariant: string,
  acceptanceLog: string,
  earlierFailures: string[],
  files: number,
): CardOutcome {
  return {
    customId,
    status: "written",
    reason: null,
    attempts: 1,
    winningVariant,
    acceptanceLog,
    earlierFailures,
    commit: "sha-" + customId,
    diffstat: { files, insertions: 1, deletions: 0 },
  };
}

// The failed outcome of §2.2 (compile fault, stale inputs, or rejected acceptance).
function failed(
  customId: string,
  reason: string,
  acceptanceLog: string,
  earlierFailures: string[],
): CardOutcome {
  return {
    customId,
    status: "failed",
    reason,
    attempts: 1,
    winningVariant: null,
    acceptanceLog,
    earlierFailures,
    commit: null,
    diffstat: null,
  };
}

test("Process Generation example 1: two stub cards accepted, the commit hook fired for each", async () => {
  const h = harness();
  try {
    h.answer("a.v1", fenced("MARK_A"));
    h.answer("b.v1", fenced("MARK_B"));
    const cards = [
      card("a", ["out/a.ts"], "grep -q MARK_A out/a.ts && echo accepted-a"),
      card("b", ["out/b.ts"], "grep -q MARK_B out/b.ts && echo accepted-b"),
    ];
    const g = await processGeneration(cards, h.deps, h.root);
    expect(g.outcomes).toStrictEqual([
      {
        customId: "a",
        status: "written",
        reason: null,
        attempts: 1,
        winningVariant: "a.v1",
        acceptanceLog: "accepted-a\n",
        earlierFailures: [],
        commit: "sha-a",
        diffstat: { files: 1, insertions: 1, deletions: 0 },
      },
      {
        customId: "b",
        status: "written",
        reason: null,
        attempts: 1,
        winningVariant: "b.v1",
        acceptanceLog: "accepted-b\n",
        earlierFailures: [],
        commit: "sha-b",
        diffstat: { files: 1, insertions: 1, deletions: 0 },
      },
    ]);
    expect(h.fired.map((f) => f.customId)).toStrictEqual(["a", "b"]);
    expect(g.usage).toStrictEqual([stubUsage("a.v1"), stubUsage("b.v1")]);
    expect(h.read("out/a.ts")).toBe(fileOf("MARK_A"));
    expect(h.read("out/b.ts")).toBe(fileOf("MARK_B"));
    expect(h.socketCalls()).toBe(0);
  } finally {
    h.rm();
  }
});

test("Process Generation example 2: a written file that fails its acceptance", async () => {
  const h = harness();
  try {
    h.answer("a.v1", fenced("MARK_A"));
    const g = await processGeneration([card("a", ["out/a.ts"], "exit 1")], h.deps, h.root);
    expect(g.outcomes).toStrictEqual([
      {
        customId: "a",
        status: "failed",
        reason: "acceptance failed",
        attempts: 1,
        winningVariant: null,
        acceptanceLog: "",
        earlierFailures: [],
        commit: null,
        diffstat: null,
      },
    ]);
    expect(h.fired).toStrictEqual([]);
    expect(g.usage).toStrictEqual([stubUsage("a.v1")]);
  } finally {
    h.rm();
  }
});

test("Process Generation example 3: a sibling's accepted write makes the next card's inputs stale", async () => {
  const h = harness();
  try {
    // shared.ts exists before the generation, so b compiles against the OLD bytes
    h.write("shared.ts", fileOf("OLD"));
    h.answer("a.v1", fenced("NEW"));
    h.answer("b.v1", fenced("MARK_B"));
    const a = card("a", ["shared.ts"], "grep -q NEW shared.ts", [], 1, "patch");
    // b's acceptance leaves a trace if it is ever run
    const b = card("b", ["out/b.ts"], "touch b-acceptance-ran; grep -q MARK_B out/b.ts", [
      "shared.ts",
    ]);
    const g = await processGeneration([a, b], h.deps, h.root);
    expect(g.outcomes).toStrictEqual([
      {
        customId: "a",
        status: "written",
        reason: null,
        attempts: 1,
        winningVariant: "a.v1",
        acceptanceLog: "",
        earlierFailures: [],
        commit: "sha-a",
        diffstat: { files: 1, insertions: 1, deletions: 0 },
      },
      {
        customId: "b",
        status: "failed",
        reason: "stale inputs",
        attempts: 1,
        winningVariant: null,
        acceptanceLog: "stale inputs: shared.ts",
        earlierFailures: [],
        commit: null,
        diffstat: null,
      },
    ]);
    expect(h.exists("b-acceptance-ran")).toBe(false);
    expect(h.exists("out/b.ts")).toBe(false);
    expect(h.fired.map((f) => f.customId)).toStrictEqual(["a"]);
    expect(h.read("shared.ts")).toBe(fileOf("NEW"));
    // b's request was sent: its usage row is reported although its answer was discarded
    expect(g.usage).toStrictEqual([stubUsage("a.v1"), stubUsage("b.v1")]);
  } finally {
    h.rm();
  }
});

test("Process Generation: a compile fault fails the card before any request", async () => {
  const h = harness();
  try {
    // an answer and a passing acceptance: only the compile gate can make this card fail
    h.answer("a.v1", fenced("MARK_A"));
    const g = await processGeneration(
      [card("a", ["out/a.ts"], "exit 0", ["missing/one.ts", "missing/two.ts"])],
      h.deps,
      h.root,
    );
    expect(g.outcomes.length).toBe(1);
    const o = g.outcomes[0];
    const faults = o.acceptanceLog.split("\n");
    expect(faults.length).toBe(2);
    expect(faults[0]).toContain("missing/one.ts");
    expect(faults[1]).toContain("missing/two.ts");
    expect(o.reason).toMatch(/^compile: /);
    expect(o).toStrictEqual(failed("a", "compile: " + faults[0], faults.join("\n"), []));
    expect(g.usage).toStrictEqual([]);
    expect(h.fired).toStrictEqual([]);
    expect(h.exists("out/a.ts")).toBe(false);
  } finally {
    h.rm();
  }
});

test("Process Generation: a compile-failed card keeps its place and the others still run", async () => {
  const h = harness();
  try {
    h.answer("a.v1", fenced("MARK_A"));
    h.answer("x.v1", fenced("MARK_X"));
    h.answer("b.v1", fenced("MARK_B"));
    const cards = [
      card("a", ["out/a.ts"], "grep -q MARK_A out/a.ts"),
      card("x", ["out/x.ts"], "grep -q MARK_X out/x.ts", ["missing/slice.ts"]),
      card("b", ["out/b.ts"], "grep -q MARK_B out/b.ts"),
    ];
    const g = await processGeneration(cards, h.deps, h.root);
    expect(g.outcomes.map((o) => o.customId)).toStrictEqual(["a", "x", "b"]);
    expect(g.outcomes[0]).toStrictEqual(written("a", "a.v1", "", [], 1));
    expect(g.outcomes[1].status).toBe("failed");
    expect(g.outcomes[1].reason).toMatch(/^compile: /);
    expect(g.outcomes[1].winningVariant === null).toBe(true);
    expect(g.outcomes[1].commit === null).toBe(true);
    expect(g.outcomes[2]).toStrictEqual(written("b", "b.v1", "", [], 1));
    // the compile-failed card adds no usage row; the other two were sent in card order
    expect(g.usage).toStrictEqual([stubUsage("a.v1"), stubUsage("b.v1")]);
    expect(h.fired.map((f) => f.customId)).toStrictEqual(["a", "b"]);
    expect(h.exists("out/x.ts")).toBe(false);
  } finally {
    h.rm();
  }
});

test("Process Generation: the second variant wins, the first's log is an earlier failure", async () => {
  const h = harness();
  try {
    h.answer("a.v1", fenced("ALPHA_ONE"));
    h.answer("a.v2", fenced("ALPHA_TWO"));
    const acceptance =
      "if grep -q ALPHA_TWO out/a.ts; then echo second; else echo first; exit 1; fi";
    const g = await processGeneration(
      [card("a", ["out/a.ts"], acceptance, [], 2)],
      h.deps,
      h.root,
    );
    expect(g.outcomes).toStrictEqual([written("a", "a.v2", "second\n", ["first\n"], 1)]);
    expect(h.fired).toStrictEqual([{ customId: "a", targets: ["out/a.ts"] }]);
    expect(g.usage).toStrictEqual([stubUsage("a.v1"), stubUsage("a.v2")]);
    expect(h.read("out/a.ts")).toBe(fileOf("ALPHA_TWO"));
  } finally {
    h.rm();
  }
});

test("Process Generation: every variant rejected keeps the last log and the earlier ones", async () => {
  const h = harness();
  try {
    h.answer("a.v1", fenced("ALPHA_ONE"));
    h.answer("a.v2", fenced("ALPHA_TWO"));
    const g = await processGeneration(
      [card("a", ["out/a.ts"], "cat out/a.ts; exit 1", [], 2)],
      h.deps,
      h.root,
    );
    expect(g.outcomes).toStrictEqual([
      failed("a", "acceptance failed", fileOf("ALPHA_TWO"), [fileOf("ALPHA_ONE")]),
    ]);
    expect(h.fired).toStrictEqual([]);
    expect(g.usage).toStrictEqual([stubUsage("a.v1"), stubUsage("a.v2")]);
  } finally {
    h.rm();
  }
});

test("Process Generation: an answer without text becomes a corrupt variant and fails", async () => {
  const h = harness();
  try {
    // no answers/a.v1.md: the stub returns text null with its error, and §2.2 hands verifyCard
    // a corrupt variant carrying that error; the passing acceptance never gets a file to check
    const g = await processGeneration([card("a", ["out/a.ts"], "exit 0")], h.deps, h.root);
    expect(g.outcomes.length).toBe(1);
    const o = g.outcomes[0];
    expect({ ...o, acceptanceLog: "" }).toStrictEqual(failed("a", "acceptance failed", "", []));
    expect(o.acceptanceLog).toContain("corrupt");
    expect(o.acceptanceLog).toContain("stub has no answer");
    expect(h.fired).toStrictEqual([]);
    expect(g.usage).toStrictEqual([stubUsage("a.v1")]);
    expect(h.exists("out/a.ts")).toBe(false);
  } finally {
    h.rm();
  }
});

test("Process Generation: a null acceptance is the empty command and accepts", async () => {
  const h = harness();
  try {
    h.answer("a.v1", fenced("MARK_A"));
    const g = await processGeneration([card("a", ["out/a.ts"], null)], h.deps, h.root);
    expect(g.outcomes).toStrictEqual([written("a", "a.v1", "", [], 1)]);
    expect(h.fired.map((f) => f.customId)).toStrictEqual(["a"]);
    expect(h.read("out/a.ts")).toBe(fileOf("MARK_A"));
  } finally {
    h.rm();
  }
});

test("Process Generation: a commit hook returning null leaves commit and diffstat null", async () => {
  const h = harness(true);
  try {
    h.answer("a.v1", fenced("MARK_A"));
    const g = await processGeneration(
      [card("a", ["out/a.ts"], "grep -q MARK_A out/a.ts")],
      h.deps,
      h.root,
    );
    expect(g.outcomes).toStrictEqual([
      {
        customId: "a",
        status: "written",
        reason: null,
        attempts: 1,
        winningVariant: "a.v1",
        acceptanceLog: "",
        earlierFailures: [],
        commit: null,
        diffstat: null,
      },
    ]);
    expect(h.fired).toStrictEqual([{ customId: "a", targets: ["out/a.ts"] }]);
  } finally {
    h.rm();
  }
});

test("Process Generation: two changed inputs are listed sorted in the stale log", async () => {
  const h = harness();
  try {
    h.write("s1.ts", fileOf("OLD"));
    h.write("s2.ts", fileOf("OLD"));
    h.answer("a1.v1", fenced("NEW"));
    h.answer("a2.v1", fenced("NEW"));
    h.answer("b.v1", fenced("MARK_B"));
    const cards = [
      card("a1", ["s1.ts"], "grep -q NEW s1.ts", [], 1, "patch"),
      card("a2", ["s2.ts"], "grep -q NEW s2.ts", [], 1, "patch"),
      card("b", ["out/b.ts"], "grep -q MARK_B out/b.ts", ["s2.ts", "s1.ts"]),
    ];
    const g = await processGeneration(cards, h.deps, h.root);
    expect(g.outcomes).toStrictEqual([
      written("a1", "a1.v1", "", [], 1),
      written("a2", "a2.v1", "", [], 1),
      failed("b", "stale inputs", "stale inputs: s1.ts, s2.ts", []),
    ]);
    expect(h.fired.map((f) => f.customId)).toStrictEqual(["a1", "a2"]);
    expect(h.exists("out/b.ts")).toBe(false);
  } finally {
    h.rm();
  }
});

test("Process Generation: an earlier card's accepted write is on disk for the next acceptance", async () => {
  const h = harness();
  try {
    h.answer("a.v1", fenced("MARK_A"));
    h.answer("b.v1", fenced("MARK_B"));
    // b does not declare out/a.ts, so it is not stale; its acceptance needs a's file
    const cards = [
      card("a", ["out/a.ts"], "grep -q MARK_A out/a.ts"),
      card("b", ["out/b.ts"], "grep -q MARK_A out/a.ts && grep -q MARK_B out/b.ts"),
    ];
    const g = await processGeneration(cards, h.deps, h.root);
    expect(g.outcomes).toStrictEqual([
      written("a", "a.v1", "", [], 1),
      written("b", "b.v1", "", [], 1),
    ]);
    expect(h.fired.map((f) => f.customId)).toStrictEqual(["a", "b"]);
  } finally {
    h.rm();
  }
});

test("Process Generation: a card with two targets parses both files and commits both", async () => {
  const h = harness();
  try {
    h.answer(
      "ab.v1",
      "FILE: out/a.ts\n```ts\nexport const a = \"MARK_A\";\n```\n" +
        "FILE: out/b.ts\n```ts\nexport const b = \"MARK_B\";\n```\n",
    );
    const g = await processGeneration(
      [card("ab", ["out/a.ts", "out/b.ts"], "grep -q MARK_A out/a.ts && grep -q MARK_B out/b.ts")],
      h.deps,
      h.root,
    );
    expect(g.outcomes).toStrictEqual([written("ab", "ab.v1", "", [], 2)]);
    expect(h.fired).toStrictEqual([{ customId: "ab", targets: ["out/a.ts", "out/b.ts"] }]);
    expect(h.read("out/a.ts")).toBe('export const a = "MARK_A";\n');
    expect(h.read("out/b.ts")).toBe('export const b = "MARK_B";\n');
  } finally {
    h.rm();
  }
});

test("Process Generation: the config's timeoutMs bounds the acceptance", async () => {
  const h = harness();
  try {
    h.deps.config.timeoutMs = 200;
    h.answer("a.v1", fenced("MARK_A"));
    const g = await processGeneration([card("a", ["out/a.ts"], "sleep 30")], h.deps, h.root);
    expect(g.outcomes.length).toBe(1);
    const o = g.outcomes[0];
    expect({ ...o, acceptanceLog: "" }).toStrictEqual(failed("a", "acceptance failed", "", []));
    expect(o.acceptanceLog).toContain("timed out after 200 ms");
    expect(h.fired).toStrictEqual([]);
  } finally {
    h.rm();
  }
});
