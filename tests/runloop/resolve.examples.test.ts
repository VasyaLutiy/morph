import { describe, expect, test } from "vitest";
import { resolveRunnable } from "../../src/runloop/resolve.js";
import type { Card } from "../../src/cards/types.js";
import type { CardOutcome, CardStatus } from "../../src/runloop/types.js";

function card(customId: string, dependsOn: string[]): Card {
  return {
    customId,
    intent: "generate",
    targets: ["src/" + customId + ".ts"],
    contextSlice: [],
    instruction: "do " + customId,
    acceptance: null,
    model: null,
    maxTokens: null,
    reasoning: null,
    variants: 1,
    dependsOn
  };
}

function skippedOutcome(customId: string, reason: string): CardOutcome {
  return {
    customId,
    status: "skipped",
    reason,
    attempts: 0,
    winningVariant: null,
    acceptanceLog: "",
    earlierFailures: [],
    commit: null,
    diffstat: null
  };
}

describe("resolveRunnable", () => {
  test("Resolve Runnable example 1: cards [a, b] with no dependsOn and empty done are all runnable", () => {
    const result = resolveRunnable([card("a", []), card("b", [])], {});
    expect(result.runnable.map((c) => c.customId)).toStrictEqual(["a", "b"]);
    expect(result.skipped).toStrictEqual([]);
  });

  test("Resolve Runnable example 2: written dependency and absent external dependency do not skip", () => {
    const b = { ...card("b", ["a"]), contextSlice: ["ext"] };
    const result = resolveRunnable([b], { a: "written" });
    expect(result.runnable).toStrictEqual([b]);
    expect(result.skipped).toStrictEqual([]);
  });

  test("Resolve Runnable example 3: failed dependency skips the card with reason 'dependency a failed'", () => {
    const result = resolveRunnable([card("b", ["a"])], { a: "failed" });
    expect(result.runnable).toStrictEqual([]);
    expect(result.skipped).toStrictEqual([skippedOutcome("b", "dependency a failed")]);
  });

  test("Resolve Runnable example 4: first non-written dependency in order names the reason", () => {
    const result = resolveRunnable([card("c", ["x", "b"])], { x: "written", b: "skipped" });
    expect(result.runnable).toStrictEqual([]);
    expect(result.skipped).toStrictEqual([skippedOutcome("c", "dependency b skipped")]);
  });

  test("keeps input order in both lists", () => {
    const result = resolveRunnable(
      [card("a", []), card("b", ["z"]), card("c", []), card("d", ["z"])],
      { z: "failed" }
    );
    expect(result.runnable.map((c) => c.customId)).toStrictEqual(["a", "c"]);
    expect(result.skipped.map((o) => o.customId)).toStrictEqual(["b", "d"]);
  });

  test("skipped outcome has every field of the interface in the documented shape", () => {
    const outcome = resolveRunnable([card("b", ["a"])], { a: "failed" }).skipped[0];
    expect(outcome).toStrictEqual({
      customId: "b",
      status: "skipped",
      reason: "dependency a failed",
      attempts: 0,
      winningVariant: null,
      acceptanceLog: "",
      earlierFailures: [],
      commit: null,
      diffstat: null
    });
  });

  test("budget-exceeded dependency skips the card", () => {
    const result = resolveRunnable([card("b", ["a"])], { a: "budget-exceeded" });
    expect(result.runnable).toStrictEqual([]);
    expect(result.skipped).toStrictEqual([skippedOutcome("b", "dependency a budget-exceeded")]);
  });

  test("a written dependency earlier in the list does not mask a failed later one", () => {
    const result = resolveRunnable([card("c", ["x", "y"])], { x: "written", y: "failed" });
    expect(result.skipped).toStrictEqual([skippedOutcome("c", "dependency y failed")]);
  });

  test("the FIRST non-written dependency in order wins over later ones", () => {
    const result = resolveRunnable(
      [card("c", ["p", "q"])],
      { p: "failed", q: "skipped" }
    );
    expect(result.skipped[0]?.reason).toBe("dependency p failed");
  });

  test("an absent dependency id is ignored even when it is the only one", () => {
    const result = resolveRunnable([card("b", ["ghost"])], {});
    expect(result.runnable.map((c) => c.customId)).toStrictEqual(["b"]);
    expect(result.skipped).toStrictEqual([]);
  });

  test("a card depending on an absent id and a written one runs", () => {
    const result = resolveRunnable([card("b", ["ext", "a"])], { a: "written" });
    expect(result.runnable).toStrictEqual([card("b", ["ext", "a"])]);
    expect(result.skipped).toStrictEqual([]);
  });

  test("empty input yields empty lists", () => {
    const result = resolveRunnable([], {});
    expect(result.runnable).toStrictEqual([]);
    expect(result.skipped).toStrictEqual([]);
  });

  test("runnable cards are returned by identity with all fields intact", () => {
    const b = card("b", ["a"]);
    const result = resolveRunnable([b], { a: "written" });
    expect(result.runnable[0]).toBe(b);
    expect(result.runnable[0]?.dependsOn).toStrictEqual(["a"]);
    expect(result.runnable[0]?.variants).toBe(1);
  });

  test("mixed done map skips only the cards whose dependencies are non-written", () => {
    const result = resolveRunnable(
      [card("a", []), card("b", ["a"]), card("c", ["a"]), card("d", ["b"])],
      { a: "written", b: "skipped" }
    );
    expect(result.runnable.map((c) => c.customId)).toStrictEqual(["a", "b", "c"]);
    expect(result.skipped.map((o) => o.reason)).toStrictEqual(["dependency b skipped"]);
  });

  test("does not mutate the input cards or the done map", () => {
    const a = card("a", []);
    const b = card("b", ["a"]);
    const done: Record<string, CardStatus> = { a: "failed" };
    const result = resolveRunnable([a, b], done);
    expect(result.skipped.length).toBe(1);
    expect(a.dependsOn).toStrictEqual([]);
    expect(b.dependsOn).toStrictEqual(["a"]);
    expect(Object.keys(done)).toStrictEqual(["a"]);
  });
});
