// P21c probe for run-transaction by docs/TASK_P21c_transaction.md §2.2 (src/runloop/transaction.ts, src/runloop/deck.ts) —
// the subset transaction (issue #12 comment 6077412737 item 2, comment 6077766447, MorphStudio 4efde92 §6): every card
// written by generations, every acceptance deferred to the full tree, blame by file:line, retries of the blamed owner to
// a fixed point, an outside line stops the run, a red end rolls everything back. Record Run Transaction examples 1-7 on
// the stub processor in tmp roots, then rows.
import fs from "node:fs";
import path from "node:path";
import { test, expect } from "vitest";
import { runTransaction } from "../../src/runloop/transaction.js";
import { runDeck } from "../../src/runloop/deck.js";
import { TRANSACTION_MARK } from "../../src/cards/transaction.js";
import type { RunDeps, RunInput, VariantRecord } from "../../src/runloop/types.js";
import type { Card } from "../../src/cards/types.js";
import { fakeFetch, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

const M = TRANSACTION_MARK + "\n";
const fence = (body: string): string => "```ts\n" + body + "```\n";
function card(customId: string, target: string, acceptance: string, dependsOn: string[] = []): Card {
  return { customId, intent: "generate", targets: [target], contextSlice: [], instruction: "write " + target,
    acceptance, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn };
}
interface H { r: TmpRoot; deps: RunDeps; commits: string[]; records: VariantRecord[] }
function harness(): H {
  const r = tmpRoot("morph-tx-");
  const commits: string[] = [];
  const records: VariantRecord[] = [];
  const deps: RunDeps = {
    config: { id: "stub", type: "stub", model: "stub", apiKey: null, baseUrl: "https://openrouter.ai/api/v1", route: "sync",
      concurrency: 4, providerOrder: null, reasoning: null, timeoutMs: 600000, maxRetries: 0, answersDir: r.root },
    transport: { fetch: fakeFetch().fetch, sleep: async () => {} },
    commit: (id: string, targets: string[]) => { commits.push(id); return { commit: "sha-" + id, diffstat: { files: targets.length, insertions: 1, deletions: 0 } }; },
    now: () => 0, env: { PATH: process.env.PATH ?? "" }, onVariant: (rec) => { records.push(rec); },
  };
  return { r, deps, commits, records };
}
const input = (h: H, cards: Card[], maxRetryBatches = 8): RunInput => ({ root: h.r.root, runId: "t1", branch: "morph/t1",
  deck: { cards, externalDependsOn: [] }, budget: { maxCards: 99, maxRetryBatches, deadline: 1e12 } });
const ids = (rows: { customId: string }[] | undefined): string[] => (rows ?? []).map((x) => x.customId);

function deferredDeck(h: H): Card[] {
  h.r.write("a.md", fence('export const a = "A1";\n'));
  h.r.write("b.md", fence('export const b = "B2";\n'));
  return [card("a", "out/a.ts", M + "grep -q B2 out/b.ts && grep -q A1 out/a.ts"), card("b", "out/b.ts", M + "grep -q B2 out/b.ts", ["a"])];
}

test("Run Transaction example 1: an acceptance that needs a later card's file is green, both committed in deck order", async () => {
  const h = harness();
  const h2 = harness();
  try {
    const res = await runTransaction(input(h, deferredDeck(h)), h.deps);
    expect(res.outcomes.map((o) => [o.customId, o.status, o.attempts, o.winningVariant, o.earlierFailures.length, o.commit]))
      .toStrictEqual([["a", "written", 1, "a.v1", 0, "sha-a"], ["b", "written", 1, "b.v1", 0, "sha-b"]]);
    expect([h.commits, res.report.generations, res.report.usageTotals.requests, ids(res.report.requests), "fault" in res.report])
      .toStrictEqual([["a", "b"], 2, 2, ["a.v1", "b.v1"], false]);
    const viaDeck = await runDeck(input(h2, deferredDeck(h2)), h2.deps);
    expect(viaDeck.outcomes.map((o) => [o.customId, o.status, o.attempts, o.commit])).toStrictEqual([["a", "written", 1, "sha-a"], ["b", "written", 1, "sha-b"]]);
  } finally { h.r.rm(); h2.r.rm(); }
});

test("Run Transaction example 2: a line naming b's file retries b only, a is green on the retried tree", async () => {
  const h = harness();
  try {
    h.r.write("a.md", fence("export const a = 1;\n"));
    h.r.write("b.md", fence('export const b = "B_OLD";\n'));
    h.r.write("b.r1.md", fence('export const b = "B_NEW";\n'));
    const cards = [card("a", "out/a.ts", M + 'grep -q B_NEW out/b.ts || { echo "out/b.ts(1,14): error TS2305: b is old"; exit 1; }'),
      card("b", "out/b.ts", M + "grep -q export out/b.ts", ["a"])];
    const res = await runTransaction(input(h, cards), h.deps);
    expect(res.outcomes.map((o) => [o.customId, o.status, o.attempts, o.winningVariant, o.earlierFailures]))
      .toStrictEqual([["a", "written", 1, "a.v1", ["out/b.ts(1,14): error TS2305: b is old\n"]], ["b", "written", 2, "b.r1.v1", []]]);
    expect([ids(res.report.requests), h.commits]).toStrictEqual([["a.v1", "b.v1", "b.r1.v1"], ["a", "b.r1"]]);
    const retry = JSON.stringify(h.records.find((x) => x.request.customId === "b.r1.v1")?.request ?? null);
    expect([retry.includes("error TS2305: b is old"), retry.includes("<previous_attempt_diff>"), h.r.read("out/b.ts")]).toStrictEqual([true, true, 'export const b = "B_NEW";\n']);
  } finally { h.r.rm(); }
});

test("Run Transaction example 3: a line naming a file outside the subset stops the run and rolls back", async () => {
  const h = harness();
  try {
    h.r.write("out/legacy.ts", "export const legacy = 0;\n");
    h.r.write("a.md", fence("export const a = 3;\n"));
    h.r.write("b.md", fence("export const b = 4;\n"));
    const cards = [card("a", "out/a.ts", M + "echo \"out/legacy.ts(3,4): error TS2304: Cannot find name 'q7'.\"; exit 1"), card("b", "out/b.ts", M + "exit 0", ["a"])];
    const res = await runTransaction(input(h, cards), h.deps);
    expect(res.outcomes.map((o) => [o.customId, o.status, o.reason, o.attempts, o.commit])).toStrictEqual([["a", "failed", "outside the subset", 1, null], ["b", "failed", "transaction rolled back", 1, null]]);
    expect(res.report.fault).toBe("outside the subset: out/legacy.ts(3,4): error TS2304: Cannot find name 'q7'.");
    expect(Object.keys(res.report).at(-1)).toBe("fault");
    expect([h.r.exists("out/a.ts"), h.r.exists("out/b.ts"), h.r.read("out/legacy.ts"), h.commits, res.report.usageTotals.requests]).toStrictEqual([false, false, "export const legacy = 0;\n", [], 2]);
  } finally { h.r.rm(); }
});

test("Run Transaction example 4: a forced judge retry after its generation sibling has written", async () => {
  const h = harness();
  try {
    h.r.write("s.md", fence('export const s = "S1";\n'));
    h.r.write("j.md", fence('test("j", () => {});\n'));
    h.r.write("j.r1.md", fence('test("j", () => {});\n'));
    h.r.write("p.md", fence('export const p = "P5";\n'));
    const cards = [card("s", "out/s.ts", M + "grep -q S1 out/s.ts"),
      card("j", "tests/s.test.ts", M + '[ -f j.once ] || { touch j.once; echo "forced red"; exit 1; }; grep -q P5 out/p.ts', ["s"]),
      card("p", "out/p.ts", M + "grep -q P5 out/p.ts", ["s"])];
    const res = await runTransaction(input(h, cards), h.deps);
    expect(res.outcomes.map((o) => [o.customId, o.status, o.attempts, o.winningVariant, o.earlierFailures]))
      .toStrictEqual([["s", "written", 1, "s.v1", []], ["j", "written", 2, "j.r1.v1", ["forced red\n"]], ["p", "written", 1, "p.v1", []]]);
    expect([ids(res.report.requests), h.commits, res.report.generations]).toStrictEqual([["s.v1", "j.v1", "p.v1", "j.r1.v1"], ["s", "j.r1", "p"], 2]);
  } finally { h.r.rm(); }
});

function exhaustedDeck(h: H): Card[] {
  h.r.write("out/a.ts", 'export const a = "OLD";\n');
  for (const n of ["a.md", "a.r1.md", "a.r2.md"]) h.r.write(n, fence('export const a = "NEW";\n'));
  h.r.write("b.md", fence("export const b = 9;\n"));
  return [card("a", "out/a.ts", M + "echo red-a7; exit 1"), card("b", "out/b.ts", M + "exit 0")];
}

test("Run Transaction example 5: a card still red after two retries rolls the whole subset back", async () => {
  const h = harness();
  try {
    const res = await runTransaction(input(h, exhaustedDeck(h)), h.deps);
    expect(res.outcomes.map((o) => [o.customId, o.status, o.reason, o.attempts, o.acceptanceLog, o.earlierFailures, o.commit]))
      .toStrictEqual([["a", "failed", "acceptance failed", 3, "red-a7\n", ["red-a7\n", "red-a7\n"], null], ["b", "failed", "transaction rolled back", 1, "", [], null]]);
    expect([ids(res.report.requests), h.commits, h.r.read("out/a.ts"), h.r.exists("out/b.ts"), "fault" in res.report])
      .toStrictEqual([["a.v1", "b.v1", "a.r1.v1", "a.r2.v1"], [], 'export const a = "OLD";\n', false, false]);
  } finally { h.r.rm(); }
});

test("Run Transaction example 6: maxRetryBatches 0 rolls back at the first red round", async () => {
  const h = harness();
  try {
    const res = await runTransaction(input(h, exhaustedDeck(h), 0), h.deps);
    expect(res.outcomes.map((o) => [o.customId, o.status, o.reason, o.attempts, o.earlierFailures])).toStrictEqual([["a", "failed", "acceptance failed", 1, []], ["b", "failed", "transaction rolled back", 1, []]]);
    expect([res.report.usageTotals.requests, h.r.read("out/a.ts")]).toStrictEqual([2, 'export const a = "OLD";\n']);
  } finally { h.r.rm(); }
});

test("Run Transaction example 7: a card that cannot be written aborts before any acceptance runs", async () => {
  const h = harness();
  try {
    h.r.write("a.md", fence("export const a = 7;\n"));
    const cards = [card("a", "out/a.ts", M + "touch ran-a; exit 0"), card("b", "out/b.ts", M + "exit 0", ["a"])];
    const res = await runTransaction(input(h, cards, 2), h.deps);
    expect(res.outcomes.map((o) => [o.customId, o.status, o.reason, o.attempts, o.commit])).toStrictEqual([["a", "failed", "transaction rolled back", 1, null], ["b", "failed", "acceptance failed", 3, null]]);
    expect(res.outcomes[1].acceptanceLog).toBe("answer corrupt: stub has no answer: " + path.join(h.r.root, "b.r2.v1.md"));
    expect([ids(res.report.requests), h.r.exists("out/a.ts"), h.r.exists("ran-a"), h.commits]).toStrictEqual([["a.v1", "b.v1", "b.r1.v1", "b.r2.v1"], false, false, []]);
  } finally { h.r.rm(); }
});

test("row: a deck without the mark runs as before, and an unblamed own red retries the card itself", async () => {
  const h = harness();
  try {
    h.r.write("c.md", fence("export const c = 1;\n"));
    const plain = await runDeck(input(h, [card("c", "out/c.ts", "grep -q 'c = 1' out/c.ts")]), h.deps);
    expect([plain.outcomes[0].status, h.commits, fs.existsSync(path.join(h.r.root, "out/c.ts"))]).toStrictEqual(["written", ["c"], true]);
  } finally { h.r.rm(); }
});

test("row: two outside lines are sorted and joined by \", \"; the logs that blame one card are joined by a newline", async () => {
  const h = harness();
  const h2 = harness();
  try {
    h.r.write("out/y.ts", "export const y = 0;\n");
    h.r.write("out/z.ts", "export const z = 0;\n");
    h.r.write("a.md", fence("export const a = 1;\n"));
    const out = await runTransaction(input(h, [card("a", "out/a.ts", M + 'echo "out/z.ts(2,2): error TS2: zz"; echo "out/y.ts(1,1): error TS1: yy"; exit 1')]), h.deps);
    expect(out.report.fault).toBe("outside the subset: out/y.ts(1,1): error TS1: yy, out/z.ts(2,2): error TS2: zz");
    h2.r.write("a.md", fence("export const a = 1;\n"));
    h2.r.write("c.md", fence("export const c = 1;\n"));
    h2.r.write("b.md", fence('export const b = "B_OLD";\n'));
    h2.r.write("b.r1.md", fence('export const b = "B_NEW";\n'));
    const two = [card("a", "out/a.ts", M + 'grep -q B_NEW out/b.ts || { echo "out/b.ts(1,1): error TS1: from a"; exit 1; }'),
      card("b", "out/b.ts", M + "exit 0"),
      card("c", "out/c.ts", M + 'grep -q B_NEW out/b.ts || { echo "out/b.ts(2,2): error TS1: from c"; exit 1; }')];
    const res = await runTransaction(input(h2, two), h2.deps);
    expect(res.outcomes.map((o) => [o.customId, o.status, o.attempts])).toStrictEqual([["a", "written", 1], ["b", "written", 2], ["c", "written", 1]]);
    const retry = JSON.stringify(h2.records.find((x) => x.request.customId === "b.r1.v1")?.request ?? null);
    expect(retry.includes(JSON.stringify("from a\n\nout/b.ts(2,2): error TS1: from c").slice(1, -1))).toBe(true);
  } finally { h.r.rm(); h2.r.rm(); }
});
