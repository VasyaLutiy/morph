// P13b probe for run-scout by docs/TASK_P13b_scout.md §2.2 (Run Scout) — the round loop of a recon session: round 0
// (the protocol, the seed, the listing head, the task), one model turn per round through the processor's sendGeneration,
// Parse Turn, Run Tool, Spend Budget; one correction of a rejected answer; one answer-only turn after a calls, reads or
// chars budget closes; rounds and the deadline end the session; usage summed per request. Record Run Scout examples 1-5,
// then the §2.2 rows. Every model turn comes from the stub processor (answers dir) or a fakeFetch transport.
import fs from "node:fs";
import { test, expect } from "vitest";
import { PROTOCOL, REMINDER, checkAnswer, openingMessages, runScout } from "../../src/scout/runScout.js";
import type { JournalEntry, ScoutOutcome, ScoutSession } from "../../src/scout/runScout.js";
import { readRegistry } from "../../src/processor/registry.js";
import type { ProcessorConfig, Transport } from "../../src/processor/types.js";
import type { ScoutFs } from "../../src/scout/cagePath.js";
import { DEFAULT_TOOL_CAPS } from "../../src/scout/runTool.js";
import { DEFAULT_BUDGETS } from "../../src/scout/spendBudget.js";
import { fakeClock, fakeFetch, fixture, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

const NODE_FS: ScoutFs = { realpath: (p) => fs.realpathSync(p), readFile: (p) => fs.readFileSync(p, "utf8") };
const FILES: Record<string, string> = {
  "README.md": "tiny\n",
  "src/a.ts": "export const a = 1;\n",
  "src/b.ts": 'import { a } from "./a.js";\nexport const b = a + 1;\n',
};
const LIST_ROOT = "LIST .: 2 entries\nREADME.md\nsrc/ (2 files)";
const LIST_SRC = "LIST src/: 2 entries\na.ts\nb.ts";
const READ_B = 'READ src/b.ts lines 1-2 of 2\n1: import { a } from "./a.js";\n2: export const b = a + 1;';
const READ_A = "READ src/a.ts lines 1-1 of 1\n1: export const a = 1;";
const GREP_A = "GREP /export const a/ in src/: 1 match in 1 file\nsrc/a.ts:1: export const a = 1;";
const NOT_LISTED = "not in the tree (missing, ignored or a directory): ";
const CALLS2 = "the call budget is spent (2 of 2 calls)";
const FINAL = (why: string): string => `\n\nThe budget is closed: ${why}. No more tools will run: send ANSWER now, the JSON object last.`;
const clock = fakeClock(0);
const NO_NET: Transport = { fetch: fakeFetch().fetch, sleep: clock.sleep };

function stub(p: TmpRoot, dir: string, answers: string[]): ProcessorConfig {
  fs.mkdirSync(p.path(dir), { recursive: true });
  answers.forEach((a, i) => p.write(`${dir}/scout.t${i + 1}.md`, a));
  return readRegistry({ MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: p.path(dir) }).configs[0];
}
function session(p: TmpRoot, over: Partial<ScoutSession> = {}): ScoutSession {
  for (const [k, v] of Object.entries(FILES)) p.write("t/" + k, v);
  return {
    question: "Make b twice a.\n",
    tree: { root: p.path("t"), files: Object.keys(FILES) },
    fs: NODE_FS,
    seedText: "",
    budgets: DEFAULT_BUDGETS,
    caps: DEFAULT_TOOL_CAPS,
    maxTokens: null,
    ...over,
  };
}
const j = (round: number, turn: JournalEntry["turn"], action: JournalEntry["action"], chars: number, error: string | null,
  cost: number | null = 0, inputTokens = 0, outputTokens = 0): JournalEntry =>
  ({ round, turn, action, chars, error, inputTokens, outputTokens, cost });

test("Run Scout example 1: LIST, READ, ANSWER — answered on its own, the answer caged and deduplicated", async () => {
  const p = tmpRoot("morph-rs-");
  try {
    const t3 = 'ANSWER {"targets": ["src/b.ts"], "context_slice": ["./src/a.ts", "src/b.ts"], "reasoning": "b uses a"}';
    const config = stub(p, "ans", ["LIST src", "Reading b.\nREAD src/b.ts", t3]);
    const got = await runScout(session(p, { seedText: "Seed: one\n" }), { config, transport: NO_NET, now: () => 5 });
    const want: ScoutOutcome = {
      status: "ok",
      answer: { targets: ["src/b.ts"], context_slice: ["src/a.ts"], reasoning: "b uses a" },
      stopReason: "the model answered on its own",
      spent: { calls: 2, reads: 1, chars: 116, rounds: 3 },
      elapsedMs: 0,
      usage: { requests: 3, inputTokens: 0, outputTokens: 0, cost: 0 },
      journal: [j(1, "action", { kind: "list", path: "src" }, 30, null),
        j(2, "action", { kind: "read", path: "src/b.ts", from: null, to: null }, 86, null), j(3, "answer", null, 0, null)],
      messages: [
        { role: "system", content: PROTOCOL },
        { role: "user", content: "Seed: one\n\n" + LIST_ROOT + "\n\nTask:\nMake b twice a.\n" },
        { role: "assistant", content: "LIST src" },
        { role: "user", content: LIST_SRC },
        { role: "assistant", content: "Reading b.\nREAD src/b.ts" },
        { role: "user", content: READ_B },
        { role: "assistant", content: t3 },
      ],
    };
    expect(got).toStrictEqual(want);
  } finally {
    p.rm();
  }
});

test("Run Scout example 2: a malformed turn, a rejected answer, a rejected correction; then a correction accepted", async () => {
  const p = tmpRoot("morph-rs-");
  try {
    const caps = { ...DEFAULT_TOOL_CAPS, listEntries: 1, grepSkip: [] };
    const config = stub(p, "ans", ["I think it is b.", 'ANSWER {"targets": ["src/c.ts"]}', 'ANSWER {"targets": ["src"]}']);
    const got = await runScout(session(p, { caps }), { config, transport: NO_NET, now: () => 5 });
    const r1 = "Turn not understood: no action: one line must start with READ, GREP, LIST or ANSWER. " + REMINDER;
    const r2 = `ANSWER rejected: targets: ${NOT_LISTED}src/c.ts. Name only files of the tree and send ANSWER again.`;
    expect(got.status).toBe("invalid_answer");
    expect(got.answer).toBe(null);
    expect(got.stopReason).toBe(`no answer: the corrected answer was rejected: targets: ${NOT_LISTED}src`);
    expect(got.spent).toStrictEqual({ calls: 0, reads: 0, chars: r1.length + r2.length, rounds: 3 });
    expect(got.journal).toStrictEqual([j(1, "malformed", null, r1.length, "no action: one line must start with READ, GREP, LIST or ANSWER"),
      j(2, "answer", null, r2.length, `targets: ${NOT_LISTED}src/c.ts`), j(3, "answer", null, 0, `targets: ${NOT_LISTED}src`)]);
    expect(got.messages[1]).toStrictEqual({ role: "user", content: "LIST .: 2 entries\nREADME.md\n… 1 more entries\n\nTask:\nMake b twice a.\n" });
    expect(got.messages.map((m) => m.role).join(",")).toBe("system,user,assistant,user,assistant,user,assistant");
    expect([got.messages[3].content, got.messages[5].content]).toStrictEqual([r1, r2]);
    const config2 = stub(p, "ans2", ['ANSWER {"targets": ["src/c.ts"]}', 'ANSWER {"targets": ["src/a.ts"], "reasoning": "a"}']);
    const ok = await runScout(session(p), { config: config2, transport: NO_NET, now: () => 5 });
    expect([ok.status, ok.stopReason, ok.spent.rounds, ok.usage.requests]).toStrictEqual(["ok", "the model answered on its own", 2, 2]);
    expect(ok.answer).toStrictEqual({ targets: ["src/a.ts"], context_slice: [], reasoning: "a" });
  } finally {
    p.rm();
  }
});

test("Run Scout example 3: the call budget closes, one answer-only turn: an answer, then a tool call", async () => {
  const p = tmpRoot("morph-rs-");
  try {
    const budgets = { calls: 2, reads: 5, chars: 100000, rounds: 10, deadlineMs: 600000 };
    const config = stub(p, "ans", ["GREP export const a -- src", "READ src/a.ts", 'ANSWER {"targets": ["src/a.ts"]}']);
    const got = await runScout(session(p, { budgets }), { config, transport: NO_NET, now: () => 5 });
    expect([got.status, got.stopReason]).toStrictEqual(["ok", "the model answered after the budget closed: the call budget is spent (2 of 2 calls)"]);
    expect(got.answer).toStrictEqual({ targets: ["src/a.ts"], context_slice: [], reasoning: "" });
    expect(got.messages[3].content).toBe(GREP_A);
    expect(got.messages[5].content).toBe(READ_A + FINAL(CALLS2));
    expect(got.spent).toStrictEqual({ calls: 2, reads: 1, chars: GREP_A.length + READ_A.length, rounds: 3 });
    const config2 = stub(p, "ans2", ["GREP export const a -- src", "READ src/a.ts", "LIST"]);
    const late = await runScout(session(p, { budgets }), { config: config2, transport: NO_NET, now: () => 5 });
    expect([late.status, late.answer, late.stopReason]).toStrictEqual(["no_answer", null,
      "no answer: the model did not answer after the budget closed: " + CALLS2]);
    expect(late.journal[2]).toStrictEqual(j(3, "action", { kind: "list", path: "" }, 0, null));
    expect([late.messages.length, late.spent.calls, late.spent.rounds]).toStrictEqual([7, 2, 3]);
  } finally {
    p.rm();
  }
});

test("Run Scout example 4: the round budget and the deadline end the session without a final turn", async () => {
  const p = tmpRoot("morph-rs-");
  try {
    const config = stub(p, "ans", ["LIST", "LIST src", 'ANSWER {"targets": ["src/a.ts"]}']);
    const got = await runScout(session(p, { budgets: { ...DEFAULT_BUDGETS, rounds: 2 } }), { config, transport: NO_NET, now: () => 5 });
    expect([got.status, got.stopReason, got.usage.requests]).toStrictEqual(["no_answer", "no answer: the round budget is spent (2 of 2 rounds)", 2]);
    expect(got.messages[got.messages.length - 1]).toStrictEqual({ role: "user", content: LIST_SRC });
    expect(got.messages.length).toBe(6);
    let t = 0;
    const now = (): number => (t += 1000);
    const late = await runScout(session(p, { budgets: { ...DEFAULT_BUDGETS, deadlineMs: 1500 } }), { config, transport: NO_NET, now });
    expect([late.status, late.stopReason, late.elapsedMs, late.usage.requests]).toStrictEqual(
      ["no_answer", "no answer: the deadline (1.5 s) passed", 3000, 2]);
    expect(late.spent).toStrictEqual({ calls: 2, reads: 0, chars: LIST_ROOT.length + LIST_SRC.length, rounds: 2 });
  } finally {
    p.rm();
  }
});

test("Run Scout example 5: a failed model call; usage and maxTokens over the openrouter transport", async () => {
  const p = tmpRoot("morph-rs-");
  try {
    const config = stub(p, "empty", []);
    const got = await runScout(session(p), { config, transport: NO_NET, now: () => 5 });
    const e = `stub has no answer: ${p.path("empty")}/scout.t1.md`;
    expect([got.status, got.stopReason]).toStrictEqual(["no_answer", "no answer: the model call failed in round 1: " + e]);
    expect(got.journal).toStrictEqual([j(1, "failed", null, 0, e)]);
    expect([got.messages.length, got.spent.rounds, got.usage.requests]).toStrictEqual([2, 0, 1]);
    const or = readRegistry({ MORPH_PROCESSOR_o_TYPE: "openrouter", MORPH_PROCESSOR_o_API_KEY: "k", MORPH_PROCESSOR_o_MODEL: "m/x",
      MORPH_PROCESSOR_o_MAX_RETRIES: "0" }).configs[0];
    const f = fakeFetch({ "https://openrouter.ai/api/v1/chat/completions": { body: {
      choices: [{ message: { content: "READ src/a.ts" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1000, completion_tokens: 50, cost: 0.25 } } } });
    const budgets = { calls: 2, reads: 5, chars: 100000, rounds: 10, deadlineMs: 600000 };
    const live = await runScout(session(p, { budgets, maxTokens: 777 }), { config: or, transport: { fetch: f.fetch, sleep: clock.sleep }, now: () => 5 });
    expect(live.usage).toStrictEqual({ requests: 3, inputTokens: 3000, outputTokens: 150, cost: 0.75 });
    expect([live.status, live.stopReason]).toStrictEqual(["no_answer", "no answer: the model did not answer after the budget closed: " + CALLS2]);
    expect(f.calls.length).toBe(3);
    const body = JSON.parse(f.calls[2].body ?? "{}") as { model: string; max_tokens: number; messages: { role: string }[] };
    expect([body.model, body.max_tokens, body.messages.length]).toStrictEqual(["m/x", 777, 6]);
    expect(live.journal.map((x) => x.cost)).toStrictEqual([0.25, 0.25, 0.25]);
    expect(live.journal[0]).toStrictEqual(j(1, "action", { kind: "read", path: "src/a.ts", from: null, to: null }, READ_A.length, null, 0.25, 1000, 50));
  } finally {
    p.rm();
  }
});

test("§2.2 rows: openingMessages and checkAnswer alone; a refused READ journaled with its error; the chars clip closes into the final turn; the two texts", async () => {
  const p = tmpRoot("morph-rs-");
  try {
    const s = session(p, { question: "Q", seedText: "S\n" });
    expect(openingMessages(s)).toStrictEqual([{ role: "system", content: PROTOCOL }, { role: "user", content: "S\n\n" + LIST_ROOT + "\n\nTask:\nQ" }]);
    expect(checkAnswer({ targets: ["src//b.ts", "src/b.ts"], context_slice: ["src/b.ts", "README.md", "README.md"], reasoning: "r" }, s.tree, NODE_FS))
      .toStrictEqual({ ok: true, answer: { targets: ["src/b.ts"], context_slice: ["README.md"], reasoning: "r" } });
    expect(checkAnswer({ targets: ["src/a.ts"], context_slice: ["../x"], reasoning: "" }, s.tree, NODE_FS))
      .toStrictEqual({ ok: false, error: "context_slice: path leaves the root: ../x" });
    const f = fakeFetch({ "https://openrouter.ai/api/v1/chat/completions": { body: { choices: [{ message: { content: "READ src/zz.ts" } }], usage: {} } } });
    const or = readRegistry({ MORPH_PROCESSOR_o_TYPE: "openrouter", MORPH_PROCESSOR_o_API_KEY: "k", MORPH_PROCESSOR_o_MODEL: "m/x", MORPH_PROCESSOR_o_MAX_RETRIES: "0" }).configs[0];
    const budgets = { calls: 9, reads: 9, chars: 60, rounds: 9, deadlineMs: 600000 };
    const got = await runScout(session(p, { budgets }), { config: or, transport: { fetch: f.fetch, sleep: clock.sleep }, now: () => 7 });
    const refused = "READ failed: " + NOT_LISTED + "src/zz.ts";
    const delivered = refused.slice(0, 60) + "\n[… clipped: the character budget is spent]";
    expect(got.journal[0]).toStrictEqual(j(1, "action", { kind: "read", path: "src/zz.ts", from: null, to: null }, delivered.length, NOT_LISTED + "src/zz.ts", null));
    expect(got.stopReason).toBe("no answer: the model did not answer after the budget closed: the character budget is spent (103 of 60 chars)");
    expect(got.usage).toStrictEqual({ requests: 2, inputTokens: 0, outputTokens: 0, cost: null });
    expect(got.messages[3].content).toBe(delivered + FINAL("the character budget is spent (103 of 60 chars)"));
    const nul = fakeFetch({ "https://openrouter.ai/api/v1/chat/completions": { body: { choices: [{ message: { content: null } }], usage: { cost: 0 } } } });
    const once = await runScout(session(p, { budgets: { ...DEFAULT_BUDGETS, rounds: 1 } }), { config: or, transport: { fetch: nul.fetch, sleep: clock.sleep }, now: () => 7 });
    const empty = "Turn not understood: empty turn. " + REMINDER;
    expect([once.status, once.stopReason, once.messages[2], once.messages[3]]).toStrictEqual(["no_answer", "no answer: the round budget is spent (1 of 1 rounds)",
      { role: "assistant", content: "" }, { role: "user", content: empty }]);
    expect(once.journal).toStrictEqual([j(1, "malformed", null, empty.length, "empty turn", 0)]);
    const rj = stub(p, "rj", ['ANSWER {"targets": ["nope.ts"]}']);
    const rejected = await runScout(session(p, { budgets: { ...DEFAULT_BUDGETS, rounds: 1 } }), { config: rj, transport: NO_NET, now: () => 7 });
    expect([rejected.status, rejected.stopReason, rejected.usage.requests]).toStrictEqual(["no_answer", "no answer: the round budget is spent (1 of 1 rounds)", 1]);
    const fin = stub(p, "fin", ["LIST", 'ANSWER {"targets": ["gone.ts"]}']);
    const late = await runScout(session(p, { budgets: { ...DEFAULT_BUDGETS, calls: 1 } }), { config: fin, transport: NO_NET, now: () => 7 });
    expect([late.status, late.stopReason]).toStrictEqual(["invalid_answer",
      "no answer: the answer after the budget closed was rejected: targets: not in the tree (missing, ignored or a directory): gone.ts"]);
    expect(PROTOCOL).toBe(fixture("scout/protocol.txt"));
    expect(REMINDER).toBe("One line per turn: READ <path> [<from>-<to>], GREP <pattern> [-- <dir>], LIST [<dir>] or ANSWER {json}.");
  } finally {
    p.rm();
  }
});
