import { test, expect } from "vitest";
import {
  spendTurn,
  stopReason,
  FINAL_TURN,
  DEFAULT_BUDGETS,
} from "../../src/scout/spendBudget.js";
import type {
  Charge,
  ScoutBudgets,
  ScoutSpent,
} from "../../src/scout/spendBudget.js";

const B: ScoutBudgets = {
  calls: 3,
  reads: 2,
  chars: 50,
  rounds: 10,
  deadlineMs: 60000,
};

test("Spend Budget example 1: one call and one read under every budget", () => {
  const charged = spendTurn(
    B,
    { calls: 0, reads: 0, chars: 0, rounds: 0 },
    { call: true, read: true, text: "x".repeat(20) },
    0,
  );
  expect(charged).toStrictEqual({
    spent: { calls: 1, reads: 1, chars: 20, rounds: 1 },
    text: "x".repeat(20),
    closed: null,
    why: null,
  });
});

test("Spend Budget example 2: a text over the remaining characters is clipped", () => {
  const charged = spendTurn(
    B,
    { calls: 1, reads: 1, chars: 40, rounds: 1 },
    { call: true, read: false, text: "y".repeat(25) },
    1000,
  );
  expect(charged).toStrictEqual({
    spent: { calls: 2, reads: 1, chars: 93, rounds: 2 },
    text: "y".repeat(10) + "\n[… clipped: the character budget is spent]",
    closed: "chars",
    why: "the character budget is spent (93 of 50 chars)",
  });
});

test("Spend Budget example 3: calls, reads and rounds each close a turn", () => {
  const calls = spendTurn(
    B,
    { calls: 2, reads: 0, chars: 0, rounds: 2 },
    { call: true, read: false, text: "ok" },
    0,
  );
  expect(calls).toStrictEqual({
    spent: { calls: 3, reads: 0, chars: 2, rounds: 3 },
    text: "ok",
    closed: "calls",
    why: "the call budget is spent (3 of 3 calls)",
  });

  const reads = spendTurn(
    B,
    { calls: 0, reads: 1, chars: 0, rounds: 0 },
    { call: true, read: true, text: "" },
    0,
  );
  expect(reads).toStrictEqual({
    spent: { calls: 1, reads: 2, chars: 0, rounds: 1 },
    text: "",
    closed: "reads",
    why: "the read budget is spent (2 of 2 reads)",
  });

  const rounds = spendTurn(
    B,
    { calls: 1, reads: 0, chars: 10, rounds: 9 },
    { call: false, read: false, text: "no action" },
    0,
  );
  expect(rounds).toStrictEqual({
    spent: { calls: 1, reads: 0, chars: 19, rounds: 10 },
    text: "no action",
    closed: "rounds",
    why: "the round budget is spent (10 of 10 rounds)",
  });
});

test("Spend Budget example 4: the closing order and the deadline", () => {
  const spent: ScoutSpent = { calls: 2, reads: 1, chars: 45, rounds: 9 };
  const charge: Charge = { call: true, read: true, text: "z".repeat(10) };
  const spentAfter = { calls: 3, reads: 2, chars: 93, rounds: 10 };
  const text = "z".repeat(5) + "\n[… clipped: the character budget is spent]";

  const atDeadline = spendTurn(
    { ...B, deadlineMs: 60000 },
    spent,
    charge,
    60000,
  );
  expect(atDeadline).toStrictEqual({
    spent: spentAfter,
    text,
    closed: "deadline",
    why: "the deadline (60 s) passed",
  });

  const beforeDeadline = spendTurn(
    { ...B, deadlineMs: 60000 },
    spent,
    charge,
    59999,
  );
  expect(beforeDeadline).toStrictEqual({
    spent: spentAfter,
    text,
    closed: "rounds",
    why: "the round budget is spent (10 of 10 rounds)",
  });

  const rounds40 = spendTurn({ ...B, rounds: 40 }, spent, charge, 0);
  expect(rounds40).toStrictEqual({
    spent: spentAfter,
    text,
    closed: "calls",
    why: "the call budget is spent (3 of 3 calls)",
  });

  const calls30 = spendTurn({ ...B, rounds: 40, calls: 30 }, spent, charge, 0);
  expect(calls30).toStrictEqual({
    spent: spentAfter,
    text,
    closed: "reads",
    why: "the read budget is spent (2 of 2 reads)",
  });

  const reads12 = spendTurn(
    { ...B, rounds: 40, calls: 30, reads: 12 },
    spent,
    charge,
    0,
  );
  expect(reads12).toStrictEqual({
    spent: spentAfter,
    text,
    closed: "chars",
    why: "the character budget is spent (93 of 50 chars)",
  });

  const tightDeadline = spendTurn(
    { ...B, deadlineMs: 1500 },
    spent,
    charge,
    1500,
  );
  expect(tightDeadline).toStrictEqual({
    spent: spentAfter,
    text,
    closed: "deadline",
    why: "the deadline (1.5 s) passed",
  });
});

test("Spend Budget example 5: the four stop reasons, FINAL_TURN and DEFAULT_BUDGETS", () => {
  expect(stopReason(true, null, null)).toBe("the model answered on its own");
  expect(
    stopReason(true, "reads", "the read budget is spent (2 of 2 reads)"),
  ).toBe(
    "the model answered after the budget closed: the read budget is spent (2 of 2 reads)",
  );
  expect(stopReason(false, "deadline", "the deadline (60 s) passed")).toBe(
    "no answer: the deadline (60 s) passed",
  );
  expect(stopReason(false, null, null)).toBe(
    "no answer: the session ended with every budget open",
  );
  expect(FINAL_TURN).toStrictEqual(["calls", "reads", "chars"]);
  expect(DEFAULT_BUDGETS).toStrictEqual({
    calls: 30,
    reads: 12,
    chars: 120000,
    rounds: 40,
    deadlineMs: 1800000,
  });
});
