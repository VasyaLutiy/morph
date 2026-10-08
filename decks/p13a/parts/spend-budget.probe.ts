// P13a probe for spend-budget by docs/TASK_P13a_scout.md §2.2 (Spend Budget) — one turn charged against the scout's five
// budgets: the round always, a call and a read when the turn made them, the delivered characters with the clip at the
// character budget; the first closed budget in the order deadline, rounds, calls, reads, chars with its sentence; and the
// stop_reason sentence. Record Spend Budget examples 1-5, then the §2.2 rows.
import { test, expect } from "vitest";
import { CLIP_MARKER, DEFAULT_BUDGETS, FINAL_TURN, spendTurn, stopReason } from "../../src/scout/spendBudget.js";
import type { Charged, ScoutBudgets, ScoutSpent } from "../../src/scout/spendBudget.js";

const B: ScoutBudgets = { calls: 3, reads: 2, chars: 50, rounds: 10, deadlineMs: 60000 };
const ZERO: ScoutSpent = { calls: 0, reads: 0, chars: 0, rounds: 0 };

test("Spend Budget example 1: a READ of 20 chars on fresh budgets closes nothing", () => {
  const want: Charged = { spent: { calls: 1, reads: 1, chars: 20, rounds: 1 }, text: "x".repeat(20), closed: null, why: null };
  expect(spendTurn(B, ZERO, { call: true, read: true, text: "x".repeat(20) }, 0)).toStrictEqual(want);
});

test("Spend Budget example 2: the character budget clips the text and closes", () => {
  const got = spendTurn(B, { calls: 1, reads: 1, chars: 40, rounds: 1 }, { call: true, read: false, text: "y".repeat(25) }, 1000);
  expect(got).toStrictEqual({
    spent: { calls: 2, reads: 1, chars: 93, rounds: 2 },
    text: "y".repeat(10) + "\n[… clipped: the character budget is spent]",
    closed: "chars",
    why: "the character budget is spent (93 of 50 chars)",
  });
});

test("Spend Budget example 3: the call, read and round budgets each close; a malformed turn spends a round only", () => {
  expect(spendTurn(B, { calls: 2, reads: 0, chars: 0, rounds: 2 }, { call: true, read: false, text: "ok" }, 0)).toStrictEqual(
    { spent: { calls: 3, reads: 0, chars: 2, rounds: 3 }, text: "ok", closed: "calls", why: "the call budget is spent (3 of 3 calls)" });
  expect(spendTurn(B, { calls: 0, reads: 1, chars: 0, rounds: 0 }, { call: true, read: true, text: "" }, 0)).toStrictEqual(
    { spent: { calls: 1, reads: 2, chars: 0, rounds: 1 }, text: "", closed: "reads", why: "the read budget is spent (2 of 2 reads)" });
  expect(spendTurn(B, { calls: 1, reads: 0, chars: 10, rounds: 9 }, { call: false, read: false, text: "no action" }, 0)).toStrictEqual(
    { spent: { calls: 1, reads: 0, chars: 19, rounds: 10 }, text: "no action", closed: "rounds", why: "the round budget is spent (10 of 10 rounds)" });
});

test("Spend Budget example 4: the order deadline, rounds, calls, reads, chars; seconds as a number", () => {
  const spent: ScoutSpent = { calls: 2, reads: 1, chars: 45, rounds: 9 };
  const charge = { call: true, read: true, text: "z".repeat(10) };
  const at = (b: ScoutBudgets, ms: number): [string | null, string | null] => {
    const r = spendTurn(b, spent, charge, ms);
    return [r.closed, r.why];
  };
  expect(at(B, 60000)).toStrictEqual(["deadline", "the deadline (60 s) passed"]);
  expect(at(B, 59999)).toStrictEqual(["rounds", "the round budget is spent (10 of 10 rounds)"]);
  expect(at({ ...B, rounds: 40 }, 0)).toStrictEqual(["calls", "the call budget is spent (3 of 3 calls)"]);
  expect(at({ ...B, rounds: 40, calls: 30 }, 0)).toStrictEqual(["reads", "the read budget is spent (2 of 2 reads)"]);
  expect(at({ ...B, rounds: 40, calls: 30, reads: 12 }, 0)).toStrictEqual(["chars", "the character budget is spent (93 of 50 chars)"]);
  expect(at({ ...B, deadlineMs: 1500 }, 1500)).toStrictEqual(["deadline", "the deadline (1.5 s) passed"]);
});

test("Spend Budget example 5: stopReason in its four cases; FINAL_TURN; the defaults", () => {
  expect(stopReason(true, null, null)).toBe("the model answered on its own");
  expect(stopReason(true, "reads", "the read budget is spent (2 of 2 reads)")).toBe(
    "the model answered after the budget closed: the read budget is spent (2 of 2 reads)");
  expect(stopReason(false, "deadline", "the deadline (60 s) passed")).toBe("no answer: the deadline (60 s) passed");
  expect(stopReason(false, null, null)).toBe("no answer: the session ended with every budget open");
  expect([...FINAL_TURN]).toStrictEqual(["calls", "reads", "chars"]);
  expect(DEFAULT_BUDGETS).toStrictEqual({ calls: 30, reads: 12, chars: 120000, rounds: 40, deadlineMs: 1800000 });
});

test("§2.2 rows: the marker; the input not changed; text exactly at the budget; a budget already overdrawn; keys in order", () => {
  expect(CLIP_MARKER).toBe("\n[… clipped: the character budget is spent]");
  const spent: ScoutSpent = { calls: 4, reads: 5, chars: 6, rounds: 7 };
  const before = JSON.stringify(spent);
  const big: ScoutBudgets = { calls: 100, reads: 100, chars: 16, rounds: 100, deadlineMs: 5000 };
  const exact = spendTurn(big, spent, { call: false, read: true, text: "abcdefghij" }, 4999);
  expect(exact).toStrictEqual({ spent: { calls: 4, reads: 6, chars: 16, rounds: 8 }, text: "abcdefghij", closed: "chars",
    why: "the character budget is spent (16 of 16 chars)" });
  expect(JSON.stringify(spent)).toBe(before);
  const over = spendTurn(big, { calls: 0, reads: 0, chars: 20, rounds: 0 }, { call: true, read: false, text: "abc" }, 0);
  expect(over.text).toBe(CLIP_MARKER);
  expect(over.spent).toStrictEqual({ calls: 1, reads: 0, chars: 63, rounds: 1 });
  expect(over.closed).toBe("chars");
  const open = spendTurn(big, ZERO, { call: true, read: false, text: "q" }, 0);
  expect(JSON.stringify(open)).toBe('{"spent":{"calls":1,"reads":0,"chars":1,"rounds":1},"text":"q","closed":null,"why":null}');
  expect(spendTurn({ ...big, calls: 1 }, ZERO, { call: false, read: false, text: "" }, 0).closed).toBe(null);
  expect(stopReason(true, "calls", "the call budget is spent (1 of 1 calls)")).toBe(
    "the model answered after the budget closed: the call budget is spent (1 of 1 calls)");
  expect(stopReason(false, "rounds", "the round budget is spent (5 of 5 rounds)")).toBe("no answer: the round budget is spent (5 of 5 rounds)");
});
