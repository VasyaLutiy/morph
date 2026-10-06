// P5 probe for resolve: resolveRunnable by docs/TASK_P5_runloop.md §2.2, one test per record
// example (Component runloop, Function Resolve Runnable), then the §2.2 rows. Pure; nulls are
// checked inside toStrictEqual, never through `??`.
import { test, expect } from "vitest";
import { resolveRunnable } from "../../src/runloop/resolve.js";
import type { Card } from "../../src/cards/types.js";
import type { CardOutcome, CardStatus } from "../../src/runloop/types.js";

const card = (customId: string, dependsOn: string[] = []): Card => ({
  customId,
  intent: "generate",
  targets: [`out/${customId}.ts`],
  contextSlice: [],
  instruction: "x",
  acceptance: "exit 0",
  model: null,
  maxTokens: null,
  reasoning: null,
  variants: 1,
  dependsOn,
});
const done = (o: Record<string, CardStatus>): Record<string, CardStatus> => o;

test("Resolve Runnable example 1: no dependencies, all runnable", () => {
  const r = resolveRunnable([card("a"), card("b")], done({}));
  expect(r.runnable.map((c) => c.customId).join(","), "runnable").toBe("a,b");
  expect(r.skipped.length, "none skipped").toBe(0);
});

test("Resolve Runnable example 2: a written dependency and an external one are runnable", () => {
  const r = resolveRunnable([card("b", ["a", "ext"])], done({ a: "written" }));
  expect(r.runnable.map((c) => c.customId).join(","), "runnable").toBe("b");
  expect(r.skipped.length, "none skipped").toBe(0);
});

test("Resolve Runnable example 3: a failed dependency skips the card", () => {
  const r = resolveRunnable([card("b", ["a"])], done({ a: "failed" }));
  expect(r.runnable.length, "none runnable").toBe(0);
  const o: CardOutcome = r.skipped[0] as CardOutcome;
  expect(o, "the skipped outcome").toStrictEqual({
    customId: "b",
    status: "skipped",
    reason: "dependency a failed",
    attempts: 0,
    winningVariant: null,
    acceptanceLog: "",
    earlierFailures: [],
    commit: null,
    diffstat: null,
  });
});

test("Resolve Runnable example 4: the first non-written dependency names the reason", () => {
  const r = resolveRunnable([card("c", ["x", "b"])], done({ x: "written", b: "skipped" }));
  expect(r.runnable.length, "none runnable").toBe(0);
  expect(r.skipped[0]?.reason, "reason").toBe("dependency b skipped");
});

test("§2.2 rows: a budget-exceeded dependency, order preserved, first non-written wins", () => {
  const r = resolveRunnable([card("a"), card("b", ["d"]), card("c")], done({ d: "budget-exceeded" }));
  expect(r.runnable.map((c) => c.customId).join(","), "runnable order").toBe("a,c");
  expect(
    r.skipped.map((o) => `${o.customId}:${o.reason}`).join("|"),
    "skipped reason",
  ).toBe("b:dependency d budget-exceeded");
  // two non-written dependencies: the FIRST in dependsOn order names the reason
  const r2 = resolveRunnable([card("e", ["a", "b"])], done({ a: "failed", b: "skipped" }));
  expect(r2.skipped[0]?.reason, "first of two non-written deps").toBe("dependency a failed");
});
