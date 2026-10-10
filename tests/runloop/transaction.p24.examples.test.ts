import { expect, test } from "vitest";
import { runTransaction } from "../../src/runloop/transaction.js";
import { TRANSACTION_MARK } from "../../src/cards/transaction.js";
import { fakeFetch, tmpRoot } from "../helpers.js";
import type { Card } from "../../src/cards/types.js";
import type { RunDeps, RunInput, VariantRecord } from "../../src/runloop/types.js";

const M = TRANSACTION_MARK + "\n";
const fence = (body: string): string => "```ts\n" + body + "```\n";

function card(
  customId: string,
  target: string,
  acceptance: string,
  dependsOn: string[] = [],
  contextSlice: string[] = [],
): Card {
  return {
    customId,
    intent: "generate",
    targets: [target],
    contextSlice,
    instruction: "write " + target,
    acceptance,
    model: null,
    maxTokens: null,
    reasoning: null,
    variants: 1,
    dependsOn,
  };
}

const once = (mark: string, line: string): string =>
  `[ -f ${mark} ] || { touch ${mark}; echo "${line}"; exit 1; }`;

function makeDeps(
  root: string,
  commits: string[],
  records: VariantRecord[],
): RunDeps {
  return {
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
      answersDir: root,
    },
    transport: { fetch: fakeFetch().fetch, sleep: async () => {} },
    commit: (id, targets) => {
      commits.push(id);
      return {
        commit: "sha-" + id,
        diffstat: { files: targets.length, insertions: 1, deletions: 0 },
      };
    },
    now: () => 0,
    env: { PATH: process.env.PATH ?? "" },
    onVariant: (rec) => {
      records.push(rec);
    },
  };
}

function makeInput(root: string, cards: Card[], maxRetryBatches = 2): RunInput {
  return {
    root,
    runId: "t1",
    branch: "morph/t1",
    deck: { cards, externalDependsOn: [] },
    budget: { maxCards: 99, maxRetryBatches, deadline: 1e12 },
  };
}

test("Run Transaction example 8: every blamed card is retried to green, one retry batch per round", async () => {
  const r = tmpRoot("morph-tx-");
  try {
    r.write("a.md", fence('export const a = "A1";\n'));
    r.write("b.md", fence('export const b = "B2";\n'));
    r.write("c.md", fence('export const c = "C3";\n'));
    r.write("a.r1.md", fence('export const a = "A4";\n'));
    r.write("b.r1.md", fence('export const b = "B5";\n'));
    r.write("c.r1.md", fence('export const c = "C6";\n'));
    const commits: string[] = [];
    const records: VariantRecord[] = [];
    const cards: Card[] = [
      card("a", "out/a.ts", M + "exit 0"),
      card("b", "out/b.ts", M + "exit 0"),
      card(
        "c",
        "out/c.ts",
        M +
          once("r0.once", "out/a.ts(1,14): error TS2305: a is old") +
          "; " +
          once("r1.once", "out/b.ts(1,14): error TS2305: b is old") +
          "; " +
          once("r2.once", "c red once"),
        ["a", "b"],
      ),
    ];
    const result = await runTransaction(
      makeInput(r.root, cards),
      makeDeps(r.root, commits, records),
    );
    expect(result.report.generations).toBe(2);
    expect(result.report.requests?.map((row) => row.customId)).toStrictEqual([
      "a.v1",
      "b.v1",
      "c.v1",
      "a.r1.v1",
      "b.r1.v1",
      "c.r1.v1",
    ]);
    const a = result.outcomes[0];
    expect(a.status).toBe("written");
    expect(a.reason).toBe(null);
    expect(a.attempts).toBe(2);
    expect(a.winningVariant).toBe("a.r1.v1");
    expect(a.lastRound).toBeUndefined();
    expect(a.acceptanceLog).toBe("");
    expect(a.earlierFailures).toStrictEqual([]);
    const b = result.outcomes[1];
    expect(b.status).toBe("written");
    expect(b.reason).toBe(null);
    expect(b.attempts).toBe(2);
    expect(b.winningVariant).toBe("b.r1.v1");
    expect(b.lastRound).toBeUndefined();
    expect(b.acceptanceLog).toBe("");
    expect(b.earlierFailures).toStrictEqual([]);
    const c = result.outcomes[2];
    expect(c.status).toBe("written");
    expect(c.reason).toBe(null);
    expect(c.attempts).toBe(2);
    expect(c.winningVariant).toBe("c.r1.v1");
    expect(c.lastRound).toBeUndefined();
    expect(c.acceptanceLog).toBe("");
    expect(c.earlierFailures).toStrictEqual([
      "out/a.ts(1,14): error TS2305: a is old\n",
      "out/b.ts(1,14): error TS2305: b is old\n",
      "c red once\n",
    ]);
    expect(commits).toStrictEqual(["a.r1", "b.r1", "c.r1"]);
    expect(result.report.stop).toBeUndefined();
    expect(result.report.fault).toBeUndefined();
    expect(r.read("out/c.ts")).toBe('export const c = "C6";\n');
  } finally {
    r.rm();
  }
});

test("Run Transaction example 9: a retry batch runs by layers, so a dependant's retry is not stale", async () => {
  const r = tmpRoot("morph-tx-");
  try {
    r.write("a.md", fence('export const a = "A7";\n'));
    r.write("a.r1.md", fence('export const a = "A8";\n'));
    r.write("j.md", fence('export const j = "J1";\n'));
    r.write("j.r1.md", fence('export const j = "J2";\n'));
    const commits: string[] = [];
    const records: VariantRecord[] = [];
    const cards: Card[] = [
      card("a", "out/a.ts", M + once("a.once", "a red once")),
      card("j", "out/j.ts", M + once("j.once", "j red once"), ["a"], ["out/a.ts"]),
    ];
    const result = await runTransaction(
      makeInput(r.root, cards),
      makeDeps(r.root, commits, records),
    );
    const a = result.outcomes[0];
    expect(a.status).toBe("written");
    expect(a.reason).toBe(null);
    expect(a.attempts).toBe(2);
    expect(a.winningVariant).toBe("a.r1.v1");
    expect(a.lastRound).toBeUndefined();
    expect(a.acceptanceLog).toBe("");
    expect(a.earlierFailures).toStrictEqual(["a red once\n"]);
    const j = result.outcomes[1];
    expect(j.status).toBe("written");
    expect(j.reason).toBe(null);
    expect(j.attempts).toBe(2);
    expect(j.winningVariant).toBe("j.r1.v1");
    expect(j.lastRound).toBeUndefined();
    expect(j.acceptanceLog).toBe("");
    expect(j.earlierFailures).toStrictEqual(["j red once\n"]);
    expect(result.report.requests?.map((row) => row.customId)).toStrictEqual([
      "a.v1",
      "j.v1",
      "a.r1.v1",
      "j.r1.v1",
    ]);
    expect(records.map((rec) => rec.request.customId)).toStrictEqual([
      "a.v1",
      "j.v1",
      "a.r1.v1",
      "j.r1.v1",
    ]);
    for (const rec of records) {
      expect(rec.verdict).toBe("accepted");
    }
    expect(records[3].request.customId).toBe("j.r1.v1");
    expect(records[3].verdict).toBe("accepted");
    expect(commits).toStrictEqual(["a.r1", "j.r1"]);
    expect(result.report.stop).toBeUndefined();
    expect(result.report.fault).toBeUndefined();
    expect(r.read("out/j.ts")).toBe('export const j = "J2";\n');
  } finally {
    r.rm();
  }
});

test("Run Transaction example 10: a blamed card capped at 2 retries rolls back with a retry-cap stop", async () => {
  const r = tmpRoot("morph-tx-");
  try {
    r.write("a.md", fence('export const a = "A2";\n'));
    r.write("a.r1.md", fence('export const a = "A3";\n'));
    r.write("a.r2.md", fence('export const a = "A5";\n'));
    r.write("b.md", fence('export const b = "B7";\n'));
    r.write("b.r1.md", fence('export const b = "B8";\n'));
    const commits: string[] = [];
    const records: VariantRecord[] = [];
    const cards: Card[] = [
      card("a", "out/a.ts", M + "echo red-a9; exit 1"),
      card("b", "out/b.ts", M + once("b.once", "b red once")),
    ];
    const result = await runTransaction(
      makeInput(r.root, cards),
      makeDeps(r.root, commits, records),
    );
    expect(result.report.stop).toBe("retry cap: a (2 retries)");
    expect(Object.keys(result.report).pop()).toBe("stop");
    expect(result.report.fault).toBeUndefined();
    const a = result.outcomes[0];
    expect(a.status).toBe("failed");
    expect(a.reason).toBe("acceptance failed");
    expect(a.attempts).toBe(3);
    expect(a.winningVariant).toBe("a.r2.v1");
    expect(a.lastRound).toBe("red");
    expect(a.acceptanceLog).toBe("red-a9\n");
    expect(a.earlierFailures).toStrictEqual(["red-a9\n", "red-a9\n"]);
    const b = result.outcomes[1];
    expect(b.status).toBe("failed");
    expect(b.reason).toBe("transaction rolled back");
    expect(b.attempts).toBe(2);
    expect(b.winningVariant).toBe("b.r1.v1");
    expect(b.lastRound).toBe("green");
    expect(b.acceptanceLog).toBe("");
    expect(b.earlierFailures).toStrictEqual(["b red once\n"]);
    expect(result.report.requests?.map((row) => row.customId)).toStrictEqual([
      "a.v1",
      "b.v1",
      "a.r1.v1",
      "b.r1.v1",
      "a.r2.v1",
    ]);
    expect(commits).toStrictEqual([]);
    expect(r.exists("out/a.ts")).toBe(false);
    expect(r.exists("out/b.ts")).toBe(false);
  } finally {
    r.rm();
  }
});

test("Run Transaction example 11: maxRetryBatches caps a card's own retries of this transaction", async () => {
  const r = tmpRoot("morph-tx-");
  try {
    r.write("a.md", fence('export const a = "A2";\n'));
    r.write("a.r1.md", fence('export const a = "A3";\n'));
    r.write("b.md", fence('export const b = "B7";\n'));
    const commits: string[] = [];
    const records: VariantRecord[] = [];
    const cards: Card[] = [
      card("a", "out/a.ts", M + "echo red-a9; exit 1"),
      card("b", "out/b.ts", M + "exit 0"),
    ];
    const result = await runTransaction(
      makeInput(r.root, cards, 1),
      makeDeps(r.root, commits, records),
    );
    expect(result.report.stop).toBe("retry cap: a (maxRetryBatches 1)");
    expect(result.report.fault).toBeUndefined();
    const a = result.outcomes[0];
    expect(a.status).toBe("failed");
    expect(a.reason).toBe("acceptance failed");
    expect(a.attempts).toBe(2);
    expect(a.winningVariant).toBe("a.r1.v1");
    expect(a.lastRound).toBe("red");
    expect(a.acceptanceLog).toBe("red-a9\n");
    expect(a.earlierFailures).toStrictEqual(["red-a9\n"]);
    const b = result.outcomes[1];
    expect(b.status).toBe("failed");
    expect(b.reason).toBe("transaction rolled back");
    expect(b.attempts).toBe(1);
    expect(b.winningVariant).toBe("b.v1");
    expect(b.lastRound).toBe("green");
    expect(b.acceptanceLog).toBe("");
    expect(b.earlierFailures).toStrictEqual([]);
    expect(result.report.requests?.map((row) => row.customId)).toStrictEqual([
      "a.v1",
      "b.v1",
      "a.r1.v1",
    ]);
    expect(commits).toStrictEqual([]);
  } finally {
    r.rm();
  }
});

test("Run Transaction: a rollback before any acceptance ran carries no lastRound key", async () => {
  const r = tmpRoot("morph-tx-");
  try {
    r.write("a.md", fence('export const a = "A1";\n'));
    const commits: string[] = [];
    const records: VariantRecord[] = [];
    const cards: Card[] = [
      card("a", "out/a.ts", M + "exit 0"),
      card("b", "out/b.ts", M + "exit 0", ["a"]),
    ];
    const result = await runTransaction(
      makeInput(r.root, cards),
      makeDeps(r.root, commits, records),
    );
    const a = result.outcomes[0];
    expect(a.status).toBe("failed");
    expect(a.reason).toBe("transaction rolled back");
    expect(a.attempts).toBe(1);
    expect(a.winningVariant).toBe("a.v1");
    expect(a.lastRound).toBeUndefined();
    expect(a.acceptanceLog).toBe("");
    expect(a.earlierFailures).toStrictEqual([]);
    expect(result.report.fault).toBeUndefined();
    expect(commits).toStrictEqual([]);
    expect(r.exists("out/a.ts")).toBe(false);
  } finally {
    r.rm();
  }
});

test("Run Transaction: the cap stop names every capped blamed card in deck order", async () => {
  const r = tmpRoot("morph-tx-");
  try {
    r.write("a.md", fence('export const a = "A1";\n'));
    r.write("a.r1.md", fence('export const a = "A1";\n'));
    r.write("a.r2.md", fence('export const a = "A1";\n'));
    r.write("b.md", fence('export const b = "B2";\n'));
    r.write("b.r1.md", fence('export const b = "B2";\n'));
    r.write("b.r2.md", fence('export const b = "B2";\n'));
    const commits: string[] = [];
    const records: VariantRecord[] = [];
    const cards: Card[] = [
      card("a", "out/a.ts", M + "echo red-a9; exit 1"),
      card("b", "out/b.ts", M + "echo red-b9; exit 1"),
    ];
    const result = await runTransaction(
      makeInput(r.root, cards),
      makeDeps(r.root, commits, records),
    );
    expect(result.report.stop).toBe("retry cap: a (2 retries), b (2 retries)");
    expect(result.report.fault).toBeUndefined();
    expect(result.report.requests?.map((row) => row.customId)).toStrictEqual([
      "a.v1",
      "b.v1",
      "a.r1.v1",
      "b.r1.v1",
      "a.r2.v1",
      "b.r2.v1",
    ]);
    expect(result.outcomes[0].attempts).toBe(3);
    expect(result.outcomes[1].attempts).toBe(3);
    expect(result.outcomes[0].lastRound).toBe("red");
    expect(result.outcomes[1].lastRound).toBe("red");
    expect(commits).toStrictEqual([]);
  } finally {
    r.rm();
  }
});

test("Run Transaction: a retry batch skips the layers that hold no blamed card", async () => {
  const r = tmpRoot("morph-tx-");
  try {
    r.write("a.md", fence('export const a = "A1";\n'));
    r.write("b.md", fence('export const b = "B2";\n'));
    r.write("c.md", fence('export const c = "C3";\n'));
    r.write("c.r1.md", fence('export const c = "C6";\n'));
    const commits: string[] = [];
    const records: VariantRecord[] = [];
    const cards: Card[] = [
      card("a", "out/a.ts", M + "exit 0"),
      card("b", "out/b.ts", M + "exit 0"),
      card("c", "out/c.ts", M + once("c.once", "c red once"), ["a"]),
    ];
    const result = await runTransaction(
      makeInput(r.root, cards),
      makeDeps(r.root, commits, records),
    );
    expect(result.report.generations).toBe(2);
    const c = result.outcomes[2];
    expect(c.status).toBe("written");
    expect(c.reason).toBe(null);
    expect(c.attempts).toBe(2);
    expect(c.winningVariant).toBe("c.r1.v1");
    expect(c.lastRound).toBeUndefined();
    expect(c.earlierFailures).toStrictEqual(["c red once\n"]);
    expect(commits).toStrictEqual(["a", "b", "c.r1"]);
    expect(result.report.requests?.map((row) => row.customId)).toStrictEqual([
      "a.v1",
      "b.v1",
      "c.v1",
      "c.r1.v1",
    ]);
    expect(result.report.stop).toBeUndefined();
    expect(result.report.fault).toBeUndefined();
    expect(r.read("out/c.ts")).toBe('export const c = "C6";\n');
  } finally {
    r.rm();
  }
});
