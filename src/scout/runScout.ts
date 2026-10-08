/**
 * Run Scout — one recon session: round 0, then one model turn per round
 * through the processor, read as an action or an answer, until an answer, a
 * closed budget or a failed call.
 *
 * Pure of clock, environment and network: the model turns come from the
 * processor's Send Generation through the injected transport, the clock is
 * `deps.now` and the tree is read through the ScoutFs parameter.
 */

import type { Message, Request } from "../compiler/types.js";
import { sendGeneration } from "../processor/send.js";
import type { ProcessorConfig, Transport } from "../processor/types.js";
import { cagePath } from "./cagePath.js";
import type { ScoutFs, ScoutTree } from "./cagePath.js";
import { parseTurn } from "./parseTurn.js";
import type { ScoutAction, ScoutAnswer } from "./parseTurn.js";
import { runTool } from "./runTool.js";
import type { ToolCaps } from "./runTool.js";
import { FINAL_TURN, spendTurn, stopReason } from "./spendBudget.js";
import type {
  BudgetName,
  Charged,
  ScoutBudgets,
  ScoutSpent
} from "./spendBudget.js";

/** The system message of every session: the scout protocol, line by line. */
export const PROTOCOL: string = [
  "You are the scout of a code repository: you find the files a task must change by reading the repository with tools, one tool per turn, and you answer with those files.",
  "Each of your turns holds exactly ONE line that starts with a verb in upper case; prose before that line is allowed:",
  "READ <path> [<from>-<to>]  the file's lines, 1-based and inclusive; a long file comes in pieces and the reply names the next range",
  "GREP <pattern> [-- <dir>]  a JavaScript regular expression tested on every line of the tree, or of the files under <dir>; a|b works",
  "LIST [<dir>]  the entries of a directory of the tree; no <dir> is the root",
  'ANSWER {"targets": [...], "context_slice": [...], "reasoning": "..."}  your final answer, the JSON object last',
  "targets: the files that must change; context_slice: the files whose definitions the change needs, read and not changed; reasoning: why, in a few sentences.",
  'Every path is relative to the repository root, with "/", and names a file of the tree as LIST shows it: no directories, globs or line ranges in the answer.',
  "Your calls, reads, characters and rounds are counted; when a budget closes you get one last turn: send ANSWER in it."
].join("\n");

/** The sentence appended to a malformed turn's reply. */
export const REMINDER: string =
  "One line per turn: READ <path> [<from>-<to>], GREP <pattern> [-- <dir>], " +
  "LIST [<dir>] or ANSWER {json}.";

/** What one session reads: the task, the tree, the seed and its budgets. */
export interface ScoutSession {
  question: string;
  tree: ScoutTree;
  fs: ScoutFs;
  seedText: string;
  budgets: ScoutBudgets;
  caps: ToolCaps;
  maxTokens: number | null;
}

/** What a session needs besides itself: the model, the transport, the clock. */
export interface ScoutDeps {
  config: ProcessorConfig;
  transport: Transport;
  now: () => number;
}

/** How a session ended. */
export type ScoutStatus = "ok" | "no_answer" | "invalid_answer";

/** One round of the session, as it was journaled. */
export interface JournalEntry {
  round: number;
  turn: "action" | "answer" | "malformed" | "failed";
  action: ScoutAction | null;
  chars: number;
  error: string | null;
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
}

/** What the whole session asked the processor for. */
export interface ScoutUsage {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
}

/** What Run Scout resolves to. */
export interface ScoutOutcome {
  status: ScoutStatus;
  answer: ScoutAnswer | null;
  stopReason: string;
  spent: ScoutSpent;
  elapsedMs: number;
  usage: ScoutUsage;
  journal: JournalEntry[];
  messages: Message[];
}

/** The answer after the cage, or the first refusal. */
export type CheckedAnswer =
  | { ok: true; answer: ScoutAnswer }
  | { ok: false; error: string };

/**
 * Round 0: the protocol as the system message, and the seed (when there is
 * one), the tree's root listing and the task as the user message. Not charged.
 */
export function openingMessages(session: ScoutSession): Message[] {
  const listing = runTool(
    { kind: "list", path: "" },
    session.tree,
    session.fs,
    session.caps
  ).text;
  const seed = session.seedText === "" ? "" : session.seedText + "\n";
  return [
    { role: "system", content: PROTOCOL },
    {
      role: "user",
      content: seed + listing + "\n\nTask:\n" + session.question
    }
  ];
}

/**
 * Cage an answer: every target, then every context_slice path, through Cage
 * Path as a file of the tree. Repeats are dropped; a slice path that is one of
 * the targets is dropped. The first refusal names the field it came from.
 */
export function checkAnswer(
  answer: ScoutAnswer,
  tree: ScoutTree,
  fs: ScoutFs
): CheckedAnswer {
  const targets: string[] = [];
  for (const target of answer.targets) {
    const caged = cagePath(tree, target, "file", fs);
    if (!caged.ok) {
      return { ok: false, error: "targets: " + caged.error };
    }
    if (!targets.includes(caged.path)) {
      targets.push(caged.path);
    }
  }

  const contextSlice: string[] = [];
  for (const path of answer.context_slice) {
    const caged = cagePath(tree, path, "file", fs);
    if (!caged.ok) {
      return { ok: false, error: "context_slice: " + caged.error };
    }
    if (targets.includes(caged.path)) continue;
    if (!contextSlice.includes(caged.path)) {
      contextSlice.push(caged.path);
    }
  }

  return {
    ok: true,
    answer: {
      targets,
      context_slice: contextSlice,
      reasoning: answer.reasoning
    }
  };
}

/**
 * Run one session to its end: the round loop, the journal, the usage and the
 * messages it leaves behind.
 */
export async function runScout(
  session: ScoutSession,
  deps: ScoutDeps
): Promise<ScoutOutcome> {
  const messages: Message[] = openingMessages(session);
  const start = deps.now();

  let spent: ScoutSpent = { calls: 0, reads: 0, chars: 0, rounds: 0 };
  const usage: ScoutUsage = {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cost: null
  };
  const journal: JournalEntry[] = [];

  let closed: BudgetName | null = null;
  let why: string | null = null;
  let final = false;
  let corrected = false;

  let status: ScoutStatus = "no_answer";
  let answer: ScoutAnswer | null = null;
  let stop = "";

  // Step 7: the charged turn's text becomes the next user message; a close of
  // deadline or rounds ends the session, a close of calls, reads or chars
  // grants one final answer-only turn. Returns true when the session ends.
  const advance = (charged: Charged): boolean => {
    if (charged.closed !== null) {
      closed = charged.closed;
      why = charged.why;
    }
    let body = charged.text;
    if (charged.closed === "deadline" || charged.closed === "rounds") {
      messages.push({ role: "user", content: body });
      status = "no_answer";
      stop = stopReason(false, charged.closed, charged.why);
      return true;
    }
    if (charged.closed !== null && FINAL_TURN.includes(charged.closed)) {
      final = true;
      body +=
        "\n\nThe budget is closed: " +
        (charged.why ?? "") +
        ". No more tools will run: send ANSWER now, the JSON object last.";
    }
    messages.push({ role: "user", content: body });
    return false;
  };

  for (;;) {
    const round = spent.rounds + 1;
    const request: Request = {
      customId: "scout.t" + String(round),
      model: null,
      maxTokens: session.maxTokens,
      reasoning: null,
      messages: messages.slice()
    };

    const generation = await sendGeneration(
      deps.config,
      [request],
      deps.transport
    );
    const reply = generation.answers[0];
    const used = generation.usage[0];

    usage.requests += 1;
    usage.inputTokens += used.inputTokens;
    usage.outputTokens += used.outputTokens;
    if (used.cost !== null) {
      usage.cost = (usage.cost ?? 0) + used.cost;
    }

    if (reply.error !== null) {
      journal.push({
        round,
        turn: "failed",
        action: null,
        chars: 0,
        error: reply.error,
        inputTokens: used.inputTokens,
        outputTokens: used.outputTokens,
        cost: used.cost
      });
      status = "no_answer";
      stop =
        "no answer: the model call failed in round " +
        String(round) +
        ": " +
        reply.error;
      break;
    }

    const text = reply.text ?? "";
    messages.push({ role: "assistant", content: text });
    const turn = parseTurn(reply.text);
    const elapsed = deps.now() - start;

    if (turn.kind === "answer") {
      const checked = checkAnswer(turn.answer, session.tree, session.fs);

      if (checked.ok) {
        const charged = spendTurn(
          session.budgets,
          spent,
          { call: false, read: false, text: "" },
          elapsed
        );
        spent = charged.spent;
        journal.push({
          round,
          turn: "answer",
          action: null,
          chars: 0,
          error: null,
          inputTokens: used.inputTokens,
          outputTokens: used.outputTokens,
          cost: used.cost
        });
        status = "ok";
        answer = checked.answer;
        stop = stopReason(true, closed, why);
        break;
      }

      const error = checked.error;

      if (final || corrected) {
        const charged = spendTurn(
          session.budgets,
          spent,
          { call: false, read: false, text: "" },
          elapsed
        );
        spent = charged.spent;
        journal.push({
          round,
          turn: "answer",
          action: null,
          chars: 0,
          error,
          inputTokens: used.inputTokens,
          outputTokens: used.outputTokens,
          cost: used.cost
        });
        status = "invalid_answer";
        answer = null;
        stop = final
          ? "no answer: the answer after the budget closed was rejected: " +
            error
          : "no answer: the corrected answer was rejected: " + error;
        break;
      }

      corrected = true;
      const correction =
        "ANSWER rejected: " +
        error +
        ". Name only files of the tree and send ANSWER again.";
      const charged = spendTurn(
        session.budgets,
        spent,
        { call: false, read: false, text: correction },
        elapsed
      );
      spent = charged.spent;
      journal.push({
        round,
        turn: "answer",
        action: null,
        chars: charged.text.length,
        error,
        inputTokens: used.inputTokens,
        outputTokens: used.outputTokens,
        cost: used.cost
      });
      if (advance(charged)) break;
      continue;
    }

    if (final) {
      const charged = spendTurn(
        session.budgets,
        spent,
        { call: false, read: false, text: "" },
        elapsed
      );
      spent = charged.spent;
      if (turn.kind === "action") {
        journal.push({
          round,
          turn: "action",
          action: turn.action,
          chars: 0,
          error: null,
          inputTokens: used.inputTokens,
          outputTokens: used.outputTokens,
          cost: used.cost
        });
      } else {
        journal.push({
          round,
          turn: "malformed",
          action: null,
          chars: 0,
          error: turn.reason,
          inputTokens: used.inputTokens,
          outputTokens: used.outputTokens,
          cost: used.cost
        });
      }
      status = "no_answer";
      stop =
        "no answer: the model did not answer after the budget closed: " +
        (why ?? "");
      break;
    }

    if (turn.kind === "action") {
      const tool = runTool(
        turn.action,
        session.tree,
        session.fs,
        session.caps
      );
      const charged = spendTurn(
        session.budgets,
        spent,
        { call: true, read: tool.read, text: tool.text },
        elapsed
      );
      spent = charged.spent;
      journal.push({
        round,
        turn: "action",
        action: turn.action,
        chars: charged.text.length,
        error: tool.error,
        inputTokens: used.inputTokens,
        outputTokens: used.outputTokens,
        cost: used.cost
      });
      if (advance(charged)) break;
      continue;
    }

    const notice = "Turn not understood: " + turn.reason + ". " + REMINDER;
    const charged = spendTurn(
      session.budgets,
      spent,
      { call: false, read: false, text: notice },
      elapsed
    );
    spent = charged.spent;
    journal.push({
      round,
      turn: "malformed",
      action: null,
      chars: charged.text.length,
      error: turn.reason,
      inputTokens: used.inputTokens,
      outputTokens: used.outputTokens,
      cost: used.cost
    });
    if (advance(charged)) break;
  }

  return {
    status,
    answer,
    stopReason: stop,
    spent,
    elapsedMs: deps.now() - start,
    usage,
    journal,
    messages
  };
}
