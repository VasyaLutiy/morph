// P27 probe for run-scout by docs/TASK_P27_scout.md §2.2 (src/scout/runScout.ts) — issue #21 items 1–5, 7, 10, 11:
// the budgets shown, a file read once, the lines not run, the correction after the close, round zero and history.
// Record Run Scout examples 1, 2 (round 0), 3, 4 (rounds), 6, 7, 8. Expected texts are literals (no sessionText call).
import fs from "node:fs";
import { test, expect } from "vitest";
import { fakeClock, fakeFetch, fixture, tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";
import { readRegistry } from "../../src/processor/registry.js";
import type { ProcessorConfig, Transport } from "../../src/processor/types.js";
import type { ScoutFs, ScoutTree } from "../../src/scout/cagePath.js";
import { PROTOCOL, REMINDER, runScout } from "../../src/scout/runScout.js";
import type { ScoutSession } from "../../src/scout/runScout.js";
import { DEFAULT_TOOL_CAPS } from "../../src/scout/runTool.js";
import { DEFAULT_BUDGETS } from "../../src/scout/spendBudget.js";

const NODE_FS: ScoutFs = { realpath: (p) => fs.realpathSync(p), readFile: (p) => fs.readFileSync(p, "utf8") };
const clock = fakeClock(0);
const NO_NET: Transport = { fetch: fakeFetch().fetch, sleep: clock.sleep };
const SHAPE = "{\"targets\": [...], \"context_slice\": [...], \"reasoning\": \"...\"}";
const SENTENCE = "Your budget: 30 tool calls, 12 files read, 120000 characters of tool replies, 40 rounds. When the calls, reads or characters run out you get one last turn: send ANSWER in it; an answer refused there gets one correction.";
const LIST_ROOT = "LIST .: 2 entries\nREADME.md (1 line)\nsrc/ (2 files)";
const LIST_SRC = "LIST src/: 2 entries\na.ts (1 line)\nb.ts (2 lines)";
const READ_A = "READ src/a.ts lines 1-1 of 1\n1: export const a = 1;";
const READ_B = "READ src/b.ts lines 1-2 of 2\n1: import { a } from \"./a.js\";\n2: export const b = a + 1;";
const GREP_A = "GREP /export const a/ in src/: 1 match in 1 file\nsrc/a.ts:1: export const a = 1;";

function writeTree(p: TmpRoot): ScoutTree {
  p.write("t/README.md", "tiny\n");
  p.write("t/src/a.ts", "export const a = 1;\n");
  p.write("t/src/b.ts", "import { a } from \"./a.js\";\nexport const b = a + 1;\n");
  return { root: p.path("t"), files: ["README.md", "src/a.ts", "src/b.ts"] };
}
function stub(p: TmpRoot, dir: string, answers: string[]): ProcessorConfig {
  fs.mkdirSync(p.path(dir), { recursive: true });
  answers.forEach((a, i) => p.write(`${dir}/scout.t${i + 1}.md`, a));
  return readRegistry({ MORPH_PROCESSOR_s_TYPE: "stub", MORPH_PROCESSOR_s_ANSWERS_DIR: p.path(dir) }).configs[0];
}
function session(tree: ScoutTree, over: Partial<ScoutSession> = {}): ScoutSession {
  return { question: "Make b twice a.\n", tree, fs: NODE_FS, seedText: "", budgets: DEFAULT_BUDGETS, caps: DEFAULT_TOOL_CAPS, maxTokens: null, ...over };
}
const run = (s: ScoutSession, config: ProcessorConfig) => runScout(s, { config, transport: NO_NET, now: () => 5 });

test("Run Scout example 1: a listing, a read and a caged answer, every reply with the budget left", async () => {
  const p = tmpRoot("morph-p27rs-");
  try {
    expect(PROTOCOL).toBe(fixture("scout/protocol.txt"));
    const config = stub(p, "ans", ["LIST src", "Reading b.\nREAD src/b.ts",
      "ANSWER {\"targets\": [\"src/b.ts\"], \"context_slice\": [\"./src/a.ts\", \"src/b.ts\"], \"reasoning\": \"b uses a\"}"]);
    const out = await run(session(writeTree(p), { seedText: "Seed: one\n" }), config);
    expect(out.status).toBe("ok");
    expect(out.spent).toStrictEqual({ calls: 2, reads: 1, chars: 135, rounds: 3 });
    expect(out.journal.map((e) => e.chars)).toStrictEqual([49, 86, 0]);
    expect(out.messages.map((m) => m.content)).toStrictEqual([
      PROTOCOL + "\n" + SENTENCE,
      "Seed: one\n\n" + LIST_ROOT + "\n\nTask:\nMake b twice a.\n",
      "LIST src",
      LIST_SRC + "\n\nBudget left: 29 calls, 12 file reads, 119951 chars, 39 rounds.",
      "Reading b.\nREAD src/b.ts",
      READ_B + "\n\nBudget left: 28 calls, 11 file reads, 119865 chars, 38 rounds.",
      "ANSWER {\"targets\": [\"src/b.ts\"], \"context_slice\": [\"./src/a.ts\", \"src/b.ts\"], \"reasoning\": \"b uses a\"}",
    ]);
  } finally { p.rm(); }
});

test("Run Scout example 2: round 0 with the line counts; REMINDER names the shape", async () => {
  const p = tmpRoot("morph-p27rs-");
  try {
    expect(REMINDER).toBe("One action line per turn: READ <path> [<from>-<to>], GREP <pattern> [-- <dir>] or LIST [<dir>]; to answer: ANSWER " + SHAPE + ".");
    const config = stub(p, "ans", ["I think it is b.", "ANSWER {\"targets\": [\"src/c.ts\"]}", "ANSWER {\"targets\": [\"src\"]}"]);
    const out = await run(session(writeTree(p), { caps: { ...DEFAULT_TOOL_CAPS, listEntries: 1, grepSkip: [] } }), config);
    expect(out.status).toBe("invalid_answer");
    expect(out.messages[1].content).toBe("LIST .: 2 entries\nREADME.md (1 line)\n… 1 more entries\n\nTask:\nMake b twice a.\n");
  } finally { p.rm(); }
});

test("Run Scout example 3: the call budget closes; the close sentence names the shape", async () => {
  const p = tmpRoot("morph-p27rs-");
  try {
    const budgets = { calls: 2, reads: 5, chars: 100000, rounds: 10, deadlineMs: 600000 };
    const config = stub(p, "ans", ["GREP export const a -- src", "READ src/a.ts", "ANSWER {\"targets\": [\"src/a.ts\"]}"]);
    const out = await run(session(writeTree(p), { budgets }), config);
    expect(out.stopReason).toBe("the model answered after the budget closed: the call budget is spent (2 of 2 calls)");
    expect(out.messages[5].content).toBe(READ_A + "\n\nBudget left: 0 calls, 4 file reads, 99869 chars, 8 rounds.\n\nThe budget is closed: the call budget is spent (2 of 2 calls). No more tools will run: send ANSWER " + SHAPE + " now, the JSON object last.");
  } finally { p.rm(); }
});

test("Run Scout example 4: the round budget ends a session; the last message holds the budget left", async () => {
  const p = tmpRoot("morph-p27rs-");
  try {
    const config = stub(p, "ans", ["LIST", "LIST src", "ANSWER {\"targets\": [\"src/a.ts\"]}"]);
    const out = await run(session(writeTree(p), { budgets: { ...DEFAULT_BUDGETS, rounds: 2 } }), config);
    expect(out.stopReason).toBe("no answer: the round budget is spent (2 of 2 rounds)");
    expect(out.messages[out.messages.length - 1].content).toBe(LIST_SRC + "\n\nBudget left: 28 calls, 12 file reads, 119900 chars, 0 rounds.");
  } finally { p.rm(); }
});

test("Run Scout example 6: the final turn reads a bare answer and grants one correction", async () => {
  const budgets = { calls: 1, reads: 5, chars: 100000, rounds: 10, deadlineMs: 600000 };
  const why = "the call budget is spent (1 of 1 calls)";
  const p = tmpRoot("morph-p27rs-");
  try {
    const tree = writeTree(p);
    const a = await run(session(tree, { budgets }), stub(p, "a", ["LIST src", "{\"targets\": [\"src/b.ts\"], \"context_slice\": [\"src/a.ts\"], \"reasoning\": \"b\"}"]));
    expect([a.status, a.stopReason]).toStrictEqual(["ok", "the model answered after the budget closed: " + why]);
    expect(a.answer).toStrictEqual({ targets: ["src/b.ts"], context_slice: ["src/a.ts"], reasoning: "b" });
    expect(a.spent).toStrictEqual({ calls: 1, reads: 0, chars: 49, rounds: 2 });
    const b = await run(session(tree, { budgets }), stub(p, "b", ["LIST src", "ANSWER {\"targets\": [\"src/b.ts\"], \"reasoning\": \"the \"b\" file\"}", "ANSWER {\"targets\": [\"src/b.ts\"]}"]));
    expect([b.status, b.stopReason]).toStrictEqual(["ok", "the model answered after the budget closed: " + why]);
    expect(b.answer).toStrictEqual({ targets: ["src/b.ts"], context_slice: [], reasoning: "" });
    expect(b.journal.map((e) => [e.turn, e.error, e.chars])).toStrictEqual([["action", null, 49], ["malformed", "ANSWER: the JSON does not parse", 0], ["answer", null, 0]]);
    expect(b.spent).toStrictEqual({ calls: 1, reads: 0, chars: 49, rounds: 3 });
    expect(b.messages[5].content).toBe("Turn not understood: ANSWER: the JSON does not parse. No more tools will run: send ANSWER " + SHAPE + " now, every path a file of the tree, the JSON object last.");
    const c = await run(session(tree, { budgets }), stub(p, "c", ["LIST src", "ANSWER {\"targets\": [\"src/c.ts\"]}", "ANSWER {\"targets\": [\"src\"]}"]));
    expect([c.status, c.stopReason]).toStrictEqual(["invalid_answer", "no answer: the answer after the budget closed was rejected twice: targets: not in the tree (missing, ignored or a directory): src"]);
    expect(c.journal.map((e) => [e.turn, e.error])).toStrictEqual([["action", null], ["answer", "targets: not in the tree (missing, ignored or a directory): src/c.ts"], ["answer", "targets: not in the tree (missing, ignored or a directory): src"]]);
    expect(c.spent).toStrictEqual({ calls: 1, reads: 0, chars: 49, rounds: 3 });
  } finally { p.rm(); }
});

test("Run Scout example 7: repeated lines, a line not run, the budget left, a file read once", async () => {
  const p = tmpRoot("morph-p27rs-");
  try {
    const config = stub(p, "ans", ["GREP export const a -- src\nGREP export const a -- src", "READ src/a.ts\nLIST\nLIST", "READ src/a.ts 1-1", "ANSWER {\"targets\": [\"src/a.ts\"]}"]);
    const out = await run(session(writeTree(p)), config);
    expect([out.status, out.stopReason]).toStrictEqual(["ok", "the model answered on its own"]);
    expect(out.spent).toStrictEqual({ calls: 3, reads: 1, chars: 182, rounds: 4 });
    expect(out.journal.map((e) => [e.turn, e.action === null ? null : e.action.kind, e.chars])).toStrictEqual([["action", "grep", 80], ["action", "read", 51], ["action", "read", 51], ["answer", null, 0]]);
    expect(out.messages[3].content).toBe(GREP_A + "\n\nBudget left: 29 calls, 12 file reads, 119920 chars, 39 rounds.");
    expect(out.messages[5].content).toBe(READ_A + "\n\nNot run: LIST. One action line per turn; equal lines count once.\n\nBudget left: 28 calls, 11 file reads, 119869 chars, 38 rounds.");
    expect(out.messages[7].content).toBe(READ_A + "\n\nBudget left: 27 calls, 11 file reads, 119818 chars, 37 rounds.");
  } finally { p.rm(); }
});

test("Run Scout example 8: round zero and the recent commits in the first message", async () => {
  const p = tmpRoot("morph-p27rs-");
  try {
    const config = stub(p, "ans", ["ANSWER {\"targets\": [\"src/a.ts\"]}"]);
    const out = await run(session(writeTree(p), { question: "Double `export const a` in src/a.ts.\n", historyText: "Recent commits (newest first):\nabc1234 files" }), config);
    expect(out.status).toBe("ok");
    expect(out.spent).toStrictEqual({ calls: 0, reads: 0, chars: 0, rounds: 1 });
    expect(out.messages[1].content).toBe(LIST_ROOT + "\n\nRound zero: the task's identifiers in the tree, found before your first turn (no budget spent):\n\"export const a\": 1 match in 1 file\nsrc/a.ts:1: export const a = 1;\n\"src/a.ts\": 0 matches in 0 files\n\nRecent commits (newest first):\nabc1234 files\n\nTask:\nDouble `export const a` in src/a.ts.\n");
  } finally { p.rm(); }
});
