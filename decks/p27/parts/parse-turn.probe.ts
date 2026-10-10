// P27 probe for parse-turn by docs/TASK_P27_scout.md §2.2 (src/scout/parseTurn.ts) — issue #21 items 1, 3, 4, 9:
// a bare JSON answer, repeated and several action lines, slash-delimited GREP, the first balanced object.
// Record Parse Turn examples 5 (changed), 7, 8, 9; examples 1 and 4 green on main by design.
import { test, expect } from "vitest";
import { parseTurn } from "../../src/scout/parseTurn.js";

const NO_ACTION = "no action: one line must start with READ, GREP, LIST or ANSWER";

test("Parse Turn example 1: unchanged reads (green on main)", () => {
  expect(parseTurn("I will check the cage first.\nREAD src/scout/cagePath.ts")).toStrictEqual({
    kind: "action", action: { kind: "read", path: "src/scout/cagePath.ts", from: null, to: null } });
});

test("Parse Turn example 4: unchanged ANSWER (green on main)", () => {
  const turn = parseTurn("ANSWER {\"context_slice\": [\"c.ts\"], \"reasoning\": \"r\", \"targets\": [\"a.ts\", \"b.ts\"]}");
  expect(JSON.stringify(turn)).toBe("{\"kind\":\"answer\",\"answer\":{\"targets\":[\"a.ts\",\"b.ts\"],\"context_slice\":[\"c.ts\"],\"reasoning\":\"r\"}}");
});

test("Parse Turn example 5: the eleven malformed turns of the record, in order", () => {
  const inputs: (string | null)[] = [null, " \n\t", "The change is in src/a.ts", "Read src/a.ts", "READX a", "{\"files\": [\"a\"]}",
    "READ", "READ a.ts 9-3", "READ a.ts 0-3", "GREP ( -- src", "GREP"];
  const reasons = ["empty turn", "empty turn", NO_ACTION, NO_ACTION, NO_ACTION, NO_ACTION, "READ needs a path",
    "READ: bad line range 9-3", "READ: bad line range 0-3", "GREP: invalid pattern /(/", "GREP needs a pattern"];
  expect(inputs.map((t) => parseTurn(t))).toStrictEqual(reasons.map((reason) => ({ kind: "malformed", reason })));
});

test("Parse Turn example 7: a bare or fenced JSON answer", () => {
  expect(parseTurn("{\"targets\": [\"a.ts\"], \"reasoning\": \"r\"}")).toStrictEqual({
    kind: "answer", answer: { targets: ["a.ts"], context_slice: [], reasoning: "r" } });
  expect(parseTurn("Here it is:\n```json\n{\"targets\": [\"a.ts\"], \"context_slice\": [\"b.ts\"]}\n```")).toStrictEqual({
    kind: "answer", answer: { targets: ["a.ts"], context_slice: ["b.ts"], reasoning: "" } });
  expect(parseTurn("{\"targets\": []}")).toStrictEqual({ kind: "malformed", reason: "ANSWER: targets must be a non-empty list of paths" });
  expect(parseTurn("{\"targets\": [\"a.ts\"], \"reasoning\": \"the \"x\" key\"}")).toStrictEqual({ kind: "malformed", reason: NO_ACTION });
});

test("Parse Turn example 8: repeated and several action lines", () => {
  const grep = parseTurn("GREP DoneWait -- .\nGREP DoneWait -- .");
  expect(JSON.stringify(grep)).toBe("{\"kind\":\"action\",\"action\":{\"kind\":\"grep\",\"pattern\":\"DoneWait\",\"path\":\".\"}}");
  const list = parseTurn("LIST a\nLIST b\nLIST a\n  LIST b  ");
  expect(JSON.stringify(list)).toBe("{\"kind\":\"action\",\"action\":{\"kind\":\"list\",\"path\":\"a\"},\"skipped\":[\"LIST b\"]}");
  expect(parseTurn("READ a.ts 9-3\nLIST")).toStrictEqual({ kind: "malformed", reason: "READ: bad line range 9-3" });
  expect(parseTurn("READ x.ts\nANSWER {\"targets\": [\"x.ts\"]}")).toStrictEqual({
    kind: "answer", answer: { targets: ["x.ts"], context_slice: [], reasoning: "" } });
});

test("Parse Turn example 9: slash-delimited GREP and the first balanced object", () => {
  expect(parseTurn("GREP /Exited\\(/")).toStrictEqual({ kind: "action", action: { kind: "grep", pattern: "Exited\\(", path: "" } });
  expect(parseTurn("GREP /LimitsUnknown/i -- src")).toStrictEqual({ kind: "action", action: { kind: "grep", pattern: "LimitsUnknown", path: "src" } });
  expect(parseTurn("GREP a/b")).toStrictEqual({ kind: "action", action: { kind: "grep", pattern: "a/b", path: "" } });
  expect(parseTurn("GREP //")).toStrictEqual({ kind: "action", action: { kind: "grep", pattern: "//", path: "" } });
  expect(parseTurn("ANSWER {\"targets\": [\"a.ts\"]}\nANSWER {\"targets\": [\"a.ts\"]}")).toStrictEqual({
    kind: "answer", answer: { targets: ["a.ts"], context_slice: [], reasoning: "" } });
  expect(parseTurn("ANSWER {\"targets\": [\"a.ts\"], \"reasoning\": \"uses } and {\"}")).toStrictEqual({
    kind: "answer", answer: { targets: ["a.ts"], context_slice: [], reasoning: "uses } and {" } });
});
