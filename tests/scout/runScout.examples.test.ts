import fs from "node:fs";
import { readRegistry } from "../../src/processor/registry.js";
import type { ProcessorConfig, Transport } from "../../src/processor/types.js";
import type { ScoutFs, ScoutTree } from "../../src/scout/cagePath.js";
import { PROTOCOL, REMINDER, runScout } from "../../src/scout/runScout.js";
import type { ScoutSession } from "../../src/scout/runScout.js";
import { DEFAULT_TOOL_CAPS, runTool } from "../../src/scout/runTool.js";
import { DEFAULT_BUDGETS } from "../../src/scout/spendBudget.js";
import {
  ANSWER_SHAPE,
  ROUND0_HEADER,
  budgetSentence,
} from "../../src/scout/sessionText.js";
import { fakeClock, fakeFetch, fixture, tmpRoot } from "../helpers.js";
import type { TmpRoot } from "../helpers.js";
import { expect, test } from "vitest";

const NODE_FS: ScoutFs = {
  realpath: (path: string): string => fs.realpathSync(path),
  readFile: (path: string): string => fs.readFileSync(path, "utf8"),
};

const clock = fakeClock(0);
const NO_NET: Transport = { fetch: fakeFetch().fetch, sleep: clock.sleep };

const QUESTION = "Make b twice a.\n";
const LIST_ROOT = "LIST .: 2 entries\nREADME.md (1 line)\nsrc/ (2 files)";
const LIST_SRC = "LIST src/: 2 entries\na.ts (1 line)\nb.ts (2 lines)";
const READ_A = "READ src/a.ts lines 1-1 of 1\n1: export const a = 1;";
const READ_B =
  "READ src/b.ts lines 1-2 of 2\n1: import { a } from \"./a.js\";\n2: export const b = a + 1;";
const GREP_A =
  "GREP /export const a/ in src/: 1 match in 1 file\nsrc/a.ts:1: export const a = 1;";
const ANSWER_A = "ANSWER {\"targets\": [\"src/a.ts\"]}";

function writeTree(p: TmpRoot): ScoutTree {
  p.write("t/README.md", "tiny\n");
  p.write("t/src/a.ts", "export const a = 1;\n");
  p.write("t/src/b.ts", "import { a } from \"./a.js\";\nexport const b = a + 1;\n");
  return { root: p.path("t"), files: ["README.md", "src/a.ts", "src/b.ts"] };
}

function stub(p: TmpRoot, dir: string, answers: string[]): ProcessorConfig {
  fs.mkdirSync(p.path(dir), { recursive: true });
  answers.forEach((answer, i) => p.write(`${dir}/scout.t${i + 1}.md`, answer));
  return readRegistry({
    MORPH_PROCESSOR_s_TYPE: "stub",
    MORPH_PROCESSOR_s_ANSWERS_DIR: p.path(dir),
  }).configs[0];
}

function session(tree: ScoutTree, over: Partial<ScoutSession> = {}): ScoutSession {
  return {
    question: QUESTION,
    tree,
    fs: NODE_FS,
    seedText: "",
    budgets: DEFAULT_BUDGETS,
    caps: DEFAULT_TOOL_CAPS,
    maxTokens: null,
    ...over,
  };
}

test("Run Scout example 1: a listing, a read and a caged answer", async () => {
  const p = tmpRoot();
  try {
    const tree = writeTree(p);
    const config = stub(p, "ans", [
      "LIST src",
      "Reading b.\nREAD src/b.ts",
      "ANSWER {\"targets\": [\"src/b.ts\"], \"context_slice\": [\"./src/a.ts\", \"src/b.ts\"], \"reasoning\": \"b uses a\"}",
    ]);
    const outcome = await runScout(session(tree, { seedText: "Seed: one\n" }), {
      config,
      transport: NO_NET,
      now: () => 5,
    });

    expect(PROTOCOL).toBe(fixture("scout/protocol.txt"));
    expect(outcome).toStrictEqual({
      status: "ok",
      answer: {
        targets: ["src/b.ts"],
        context_slice: ["src/a.ts"],
        reasoning: "b uses a",
      },
      stopReason: "the model answered on its own",
      spent: { calls: 2, reads: 1, chars: 135, rounds: 3 },
      elapsedMs: 0,
      usage: { requests: 3, inputTokens: 0, outputTokens: 0, cost: 0 },
      journal: [
        {
          round: 1,
          turn: "action",
          action: { kind: "list", path: "src" },
          chars: 49,
          error: null,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
        },
        {
          round: 2,
          turn: "action",
          action: { kind: "read", path: "src/b.ts", from: null, to: null },
          chars: 86,
          error: null,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
        },
        {
          round: 3,
          turn: "answer",
          action: null,
          chars: 0,
          error: null,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
        },
      ],
      messages: [
        {
          role: "system",
          content: PROTOCOL + "\n" + budgetSentence(DEFAULT_BUDGETS),
        },
        {
          role: "user",
          content: "Seed: one\n\n" + LIST_ROOT + "\n\nTask:\n" + QUESTION,
        },
        { role: "assistant", content: "LIST src" },
        {
          role: "user",
          content:
            LIST_SRC +
            "\n\nBudget left: 29 calls, 12 file reads, 119951 chars, 39 rounds.",
        },
        { role: "assistant", content: "Reading b.\nREAD src/b.ts" },
        {
          role: "user",
          content:
            READ_B +
            "\n\nBudget left: 28 calls, 11 file reads, 119865 chars, 38 rounds.",
        },
        {
          role: "assistant",
          content:
            "ANSWER {\"targets\": [\"src/b.ts\"], \"context_slice\": [\"./src/a.ts\", \"src/b.ts\"], \"reasoning\": \"b uses a\"}",
        },
      ],
    });
  } finally {
    p.rm();
  }
});

test("Run Scout example 2: a malformed turn, a rejected answer and one correction", async () => {
  const p = tmpRoot();
  try {
    const tree = writeTree(p);
    const caps = { ...DEFAULT_TOOL_CAPS, listEntries: 1, grepSkip: [] };
    const reason = "no action: one line must start with READ, GREP, LIST or ANSWER";
    const notice = "Turn not understood: " + reason + ". " + REMINDER;
    const rejected =
      "targets: not in the tree (missing, ignored or a directory): src/c.ts";
    const correction =
      "ANSWER rejected: " +
      rejected +
      ". Name only files of the tree and send ANSWER again.";
    const config = stub(p, "ans", [
      "I think it is b.",
      "ANSWER {\"targets\": [\"src/c.ts\"]}",
      "ANSWER {\"targets\": [\"src\"]}",
    ]);
    const outcome = await runScout(session(tree, { caps }), {
      config,
      transport: NO_NET,
      now: () => 5,
    });

    expect(outcome.status).toBe("invalid_answer");
    expect(outcome.answer).toBe(null);
    expect(outcome.stopReason).toBe(
      "no answer: the corrected answer was rejected: targets: not in the tree (missing, ignored or a directory): src",
    );
    expect(outcome.spent).toStrictEqual({
      calls: 0,
      reads: 0,
      chars: notice.length + correction.length,
      rounds: 3,
    });
    expect(outcome.journal).toStrictEqual([
      {
        round: 1,
        turn: "malformed",
        action: null,
        chars: notice.length,
        error: reason,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
      },
      {
        round: 2,
        turn: "answer",
        action: null,
        chars: correction.length,
        error: rejected,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
      },
      {
        round: 3,
        turn: "answer",
        action: null,
        chars: 0,
        error: "targets: not in the tree (missing, ignored or a directory): src",
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
      },
    ]);
    expect(outcome.messages.map((message) => message.role)).toStrictEqual([
      "system",
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
      "assistant",
    ]);
    const listing = runTool({ kind: "list", path: "" }, tree, NODE_FS, caps).text;
    expect(listing).toContain("1 more entries");
    expect(outcome.messages[1].content).toBe(listing + "\n\nTask:\n" + QUESTION);

    const second = await runScout(session(tree, { caps }), {
      config: stub(p, "ans2", [
        "ANSWER {\"targets\": [\"src/c.ts\"]}",
        "ANSWER {\"targets\": [\"src/a.ts\"], \"reasoning\": \"a\"}",
      ]),
      transport: NO_NET,
      now: () => 5,
    });
    expect(second.status).toBe("ok");
    expect(second.answer).toStrictEqual({
      targets: ["src/a.ts"],
      context_slice: [],
      reasoning: "a",
    });
    expect(second.stopReason).toBe("the model answered on its own");
    expect(second.spent.rounds).toBe(2);
    expect(second.usage.requests).toBe(2);
  } finally {
    p.rm();
  }
});

test("Run Scout example 3: the call budget closes and one last answer comes", async () => {
  const p = tmpRoot();
  try {
    const tree = writeTree(p);
    const budgets = {
      calls: 2,
      reads: 5,
      chars: 100000,
      rounds: 10,
      deadlineMs: 600000,
    };
    const close =
      "\n\nThe budget is closed: the call budget is spent (2 of 2 calls). No more tools will run: send ANSWER " +
      ANSWER_SHAPE +
      " now, the JSON object last.";
    const answers = ["GREP export const a -- src", "READ src/a.ts", ANSWER_A];
    const outcome = await runScout(session(tree, { budgets }), {
      config: stub(p, "ans", answers),
      transport: NO_NET,
      now: () => 5,
    });

    expect(outcome.status).toBe("ok");
    expect(outcome.answer).toStrictEqual({
      targets: ["src/a.ts"],
      context_slice: [],
      reasoning: "",
    });
    expect(outcome.stopReason).toBe(
      "the model answered after the budget closed: the call budget is spent (2 of 2 calls)",
    );
    expect(outcome.spent).toStrictEqual({
      calls: 2,
      reads: 1,
      chars: GREP_A.length + READ_A.length,
      rounds: 3,
    });
    expect(outcome.messages[3].content).toBe(
      GREP_A + "\n\nBudget left: 1 calls, 5 file reads, 99920 chars, 9 rounds.",
    );
    expect(outcome.messages[5].content).toBe(
      READ_A +
        "\n\nBudget left: 0 calls, 4 file reads, 99869 chars, 8 rounds." +
        close,
    );

    const second = await runScout(session(tree, { budgets }), {
      config: stub(p, "ans2", ["GREP export const a -- src", "READ src/a.ts", "LIST"]),
      transport: NO_NET,
      now: () => 5,
    });
    expect(second.status).toBe("no_answer");
    expect(second.answer).toBe(null);
    expect(second.stopReason).toBe(
      "no answer: the model did not answer after the budget closed: the call budget is spent (2 of 2 calls)",
    );
    expect(second.journal[2]).toStrictEqual({
      round: 3,
      turn: "action",
      action: { kind: "list", path: "" },
      chars: 0,
      error: null,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
    });
    expect(second.messages.length).toBe(7);
    expect(second.spent).toStrictEqual({
      calls: 2,
      reads: 1,
      chars: GREP_A.length + READ_A.length,
      rounds: 3,
    });
  } finally {
    p.rm();
  }
});

test("Run Scout example 4: the round budget and the deadline end a session", async () => {
  const p = tmpRoot();
  try {
    const tree = writeTree(p);
    const answers = ["LIST", "LIST src", ANSWER_A];
    const outcome = await runScout(
      session(tree, { budgets: { ...DEFAULT_BUDGETS, rounds: 2 } }),
      { config: stub(p, "ans", answers), transport: NO_NET, now: () => 5 },
    );

    expect(outcome.status).toBe("no_answer");
    expect(outcome.answer).toBe(null);
    expect(outcome.stopReason).toBe(
      "no answer: the round budget is spent (2 of 2 rounds)",
    );
    expect(outcome.usage.requests).toBe(2);
    expect(outcome.messages.length).toBe(6);
    expect(outcome.messages[5]).toStrictEqual({
      role: "user",
      content:
        LIST_SRC +
        "\n\nBudget left: 28 calls, 12 file reads, 119900 chars, 0 rounds.",
    });
    expect(outcome.spent).toStrictEqual({
      calls: 2,
      reads: 0,
      chars: LIST_ROOT.length + LIST_SRC.length,
      rounds: 2,
    });

    let ticks = 0;
    const now = (): number => {
      ticks += 1000;
      return ticks;
    };
    const second = await runScout(
      session(tree, { budgets: { ...DEFAULT_BUDGETS, deadlineMs: 1500 } }),
      { config: stub(p, "ans2", answers), transport: NO_NET, now },
    );
    expect(second.status).toBe("no_answer");
    expect(second.answer).toBe(null);
    expect(second.stopReason).toBe("no answer: the deadline (1.5 s) passed");
    expect(second.elapsedMs).toBe(3000);
    expect(second.usage.requests).toBe(2);
    expect(second.messages.length).toBe(6);
    expect(second.spent).toStrictEqual({
      calls: 2,
      reads: 0,
      chars: LIST_ROOT.length + LIST_SRC.length,
      rounds: 2,
    });
  } finally {
    p.rm();
  }
});

test("Run Scout example 5: a failed model call and an openrouter session", async () => {
  const p = tmpRoot();
  try {
    const tree = writeTree(p);
    const failure = await runScout(session(tree), {
      config: stub(p, "empty", []),
      transport: NO_NET,
      now: () => 5,
    });
    const error = "stub has no answer: " + p.path("empty/scout.t1.md");

    expect(failure.status).toBe("no_answer");
    expect(failure.answer).toBe(null);
    expect(failure.stopReason).toBe(
      "no answer: the model call failed in round 1: " + error,
    );
    expect(failure.journal).toStrictEqual([
      {
        round: 1,
        turn: "failed",
        action: null,
        chars: 0,
        error,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
      },
    ]);
    expect(failure.messages.length).toBe(2);
    expect(failure.spent.rounds).toBe(0);
    expect(failure.usage.requests).toBe(1);

    const net = fakeFetch({
      "https://openrouter.ai/api/v1/chat/completions": {
        body: {
          choices: [
            { message: { content: "READ src/a.ts" }, finish_reason: "stop" },
          ],
          usage: { prompt_tokens: 1000, completion_tokens: 50, cost: 0.25 },
        },
      },
    });
    const transport: Transport = { fetch: net.fetch, sleep: clock.sleep };
    const config = readRegistry({
      MORPH_PROCESSOR_o_TYPE: "openrouter",
      MORPH_PROCESSOR_o_MODEL: "m/x",
      MORPH_PROCESSOR_o_API_KEY: "k",
      MORPH_PROCESSOR_o_MAX_RETRIES: "0",
    }).configs[0];
    const budgets = {
      calls: 2,
      reads: 5,
      chars: 100000,
      rounds: 10,
      deadlineMs: 600000,
    };
    const outcome = await runScout(session(tree, { budgets, maxTokens: 777 }), {
      config,
      transport,
      now: () => 5,
    });

    expect(outcome.status).toBe("no_answer");
    expect(outcome.answer).toBe(null);
    expect(outcome.stopReason).toBe(
      "no answer: the model did not answer after the budget closed: the call budget is spent (2 of 2 calls)",
    );
    expect(outcome.usage).toStrictEqual({
      requests: 3,
      inputTokens: 3000,
      outputTokens: 150,
      cost: 0.75,
    });
    expect(net.calls.length).toBe(3);
    const body = JSON.parse(net.calls[2].body ?? "{}") as {
      model?: unknown;
      max_tokens?: unknown;
      messages?: unknown[];
    };
    expect(body.model).toBe("m/x");
    expect(body.max_tokens).toBe(777);
    expect(body.messages?.length).toBe(6);
    expect(outcome.messages.length).toBe(7);
    expect(outcome.spent.reads).toBe(1);
    expect(outcome.journal.map((entry) => entry.cost)).toStrictEqual([
      0.25, 0.25, 0.25,
    ]);
    expect(outcome.journal[0]).toStrictEqual({
      round: 1,
      turn: "action",
      action: { kind: "read", path: "src/a.ts", from: null, to: null },
      chars: 51,
      error: null,
      inputTokens: 1000,
      outputTokens: 50,
      cost: 0.25,
    });
  } finally {
    p.rm();
  }
});

test("Run Scout example 6: the final turn reads a bare answer and grants one correction", async () => {
  const p = tmpRoot();
  try {
    const tree = writeTree(p);
    const budgets = {
      calls: 1,
      reads: 5,
      chars: 100000,
      rounds: 10,
      deadlineMs: 600000,
    };

    const a = await runScout(session(tree, { budgets }), {
      config: stub(p, "ans6a", [
        "LIST src",
        "{\"targets\": [\"src/b.ts\"], \"context_slice\": [\"src/a.ts\"], \"reasoning\": \"b\"}",
      ]),
      transport: NO_NET,
      now: () => 5,
    });
    expect(a.status).toBe("ok");
    expect(a.answer).toStrictEqual({
      targets: ["src/b.ts"],
      context_slice: ["src/a.ts"],
      reasoning: "b",
    });
    expect(a.stopReason).toBe(
      "the model answered after the budget closed: the call budget is spent (1 of 1 calls)",
    );
    expect(a.spent).toStrictEqual({ calls: 1, reads: 0, chars: 49, rounds: 2 });

    const b = await runScout(session(tree, { budgets }), {
      config: stub(p, "ans6b", [
        "LIST src",
        "ANSWER {\"targets\": [\"src/b.ts\"], \"reasoning\": \"the \"b\" file\"}",
        "ANSWER {\"targets\": [\"src/b.ts\"]}",
      ]),
      transport: NO_NET,
      now: () => 5,
    });
    expect(b.status).toBe("ok");
    expect(b.answer).toStrictEqual({
      targets: ["src/b.ts"],
      context_slice: [],
      reasoning: "",
    });
    expect(b.stopReason).toBe(
      "the model answered after the budget closed: the call budget is spent (1 of 1 calls)",
    );
    expect(b.journal.map((entry) => entry.turn)).toStrictEqual([
      "action",
      "malformed",
      "answer",
    ]);
    expect(b.journal[1].error).toBe("ANSWER: the JSON does not parse");
    expect(b.journal[1].chars).toBe(0);
    expect(b.spent).toStrictEqual({ calls: 1, reads: 0, chars: 49, rounds: 3 });
    expect(b.messages[5].content).toBe(
      "Turn not understood: ANSWER: the JSON does not parse. No more tools will run: send ANSWER " +
        ANSWER_SHAPE +
        " now, every path a file of the tree, the JSON object last.",
    );

    const c = await runScout(session(tree, { budgets }), {
      config: stub(p, "ans6c", [
        "LIST src",
        "ANSWER {\"targets\": [\"src/c.ts\"]}",
        "ANSWER {\"targets\": [\"src\"]}",
      ]),
      transport: NO_NET,
      now: () => 5,
    });
    expect(c.status).toBe("invalid_answer");
    expect(c.answer).toBe(null);
    expect(c.stopReason).toBe(
      "no answer: the answer after the budget closed was rejected twice: targets: not in the tree (missing, ignored or a directory): src",
    );
    expect(c.journal.map((entry) => entry.turn)).toStrictEqual([
      "action",
      "answer",
      "answer",
    ]);
    expect(c.journal[1].error).toBe(
      "targets: not in the tree (missing, ignored or a directory): src/c.ts",
    );
    expect(c.journal[2].error).toBe(
      "targets: not in the tree (missing, ignored or a directory): src",
    );
    expect(c.spent).toStrictEqual({ calls: 1, reads: 0, chars: 49, rounds: 3 });
  } finally {
    p.rm();
  }
});

test("Run Scout example 7: repeated lines, a line not run, the budget left, a file read once", async () => {
  const p = tmpRoot();
  try {
    const tree = writeTree(p);
    const outcome = await runScout(session(tree), {
      config: stub(p, "ans", [
        "GREP export const a -- src\nGREP export const a -- src",
        "READ src/a.ts\nLIST\nLIST",
        "READ src/a.ts 1-1",
        "ANSWER {\"targets\": [\"src/a.ts\"]}",
      ]),
      transport: NO_NET,
      now: () => 5,
    });

    expect(outcome.status).toBe("ok");
    expect(outcome.answer).toStrictEqual({
      targets: ["src/a.ts"],
      context_slice: [],
      reasoning: "",
    });
    expect(outcome.stopReason).toBe("the model answered on its own");
    expect(outcome.spent).toStrictEqual({
      calls: 3,
      reads: 1,
      chars: 182,
      rounds: 4,
    });
    expect(outcome.journal.map((entry) => entry.turn)).toStrictEqual([
      "action",
      "action",
      "action",
      "answer",
    ]);
    expect(outcome.journal.map((entry) => entry.chars)).toStrictEqual([
      80, 51, 51, 0,
    ]);
    expect(outcome.messages[3].content).toBe(
      GREP_A +
        "\n\nBudget left: 29 calls, 12 file reads, 119920 chars, 39 rounds.",
    );
    expect(outcome.messages[5].content).toBe(
      READ_A +
        "\n\nNot run: LIST. One action line per turn; equal lines count once.\n\nBudget left: 28 calls, 11 file reads, 119869 chars, 38 rounds.",
    );
    expect(outcome.messages[7].content).toBe(
      READ_A +
        "\n\nBudget left: 27 calls, 11 file reads, 119818 chars, 37 rounds.",
    );
  } finally {
    p.rm();
  }
});

test("Run Scout example 8: round zero and the recent commits in the first message", async () => {
  const p = tmpRoot();
  try {
    const tree = writeTree(p);
    const outcome = await runScout(
      session(tree, {
        question: "Double `export const a` in src/a.ts.\n",
        seedText: "",
        historyText: "Recent commits (newest first):\nabc1234 files",
      }),
      {
        config: stub(p, "ans", ['ANSWER {"targets": ["src/a.ts"]}']),
        transport: NO_NET,
        now: () => 5,
      },
    );

    expect(outcome.status).toBe("ok");
    expect(outcome.spent).toStrictEqual({
      calls: 0,
      reads: 0,
      chars: 0,
      rounds: 1,
    });
    expect(outcome.messages[1].content).toBe(
      "LIST .: 2 entries\nREADME.md (1 line)\nsrc/ (2 files)\n\n" +
        ROUND0_HEADER +
        "\n\"export const a\": 1 match in 1 file\nsrc/a.ts:1: export const a = 1;\n\"src/a.ts\": 0 matches in 0 files\n\nRecent commits (newest first):\nabc1234 files\n\nTask:\nDouble `export const a` in src/a.ts.\n",
    );
  } finally {
    p.rm();
  }
});
