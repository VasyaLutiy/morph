// P13a probe for parse-turn by docs/TASK_P13a_scout.md §2.2 (Parse Turn) — one model turn of the scout protocol read as one
// action (READ, GREP, LIST), a final answer (ANSWER + one JSON object) or a malformed turn with its pinned reason.
// Record Parse Turn examples 1-6, then the §2.2 rows.
import { test, expect } from "vitest";
import { VERBS, parseTurn } from "../../src/scout/parseTurn.js";
import type { ScoutAction, ScoutAnswer, Turn } from "../../src/scout/parseTurn.js";

const act = (action: ScoutAction): Turn => ({ kind: "action", action });
const bad = (reason: string): Turn => ({ kind: "malformed", reason });
const ans = (answer: ScoutAnswer): Turn => ({ kind: "answer", answer });

test("Parse Turn example 1: READ with prose before it, a path with a space and a line range, CRLF", () => {
  expect(parseTurn("I will check the cage first.\nREAD src/scout/cagePath.ts")).toStrictEqual(
    act({ kind: "read", path: "src/scout/cagePath.ts", from: null, to: null }));
  expect(parseTurn("READ lib/b one.ts 12-40")).toStrictEqual(act({ kind: "read", path: "lib/b one.ts", from: 12, to: 40 }));
  expect(parseTurn("  READ src/a.ts 7-7\r\n")).toStrictEqual(act({ kind: "read", path: "src/a.ts", from: 7, to: 7 }));
});

test("Parse Turn example 2: GREP split on the last ' -- ', or the whole tree", () => {
  expect(parseTurn("GREP readOwnership|readMorphLog -- src/git")).toStrictEqual(
    act({ kind: "grep", pattern: "readOwnership|readMorphLog", path: "src/git" }));
  expect(parseTurn("GREP a -- b -- tests")).toStrictEqual(act({ kind: "grep", pattern: "a -- b", path: "tests" }));
  expect(parseTurn("GREP export function")).toStrictEqual(act({ kind: "grep", pattern: "export function", path: "" }));
});

test("Parse Turn example 3: LIST of the root and of a directory inside a fence", () => {
  expect(parseTurn("LIST")).toStrictEqual(act({ kind: "list", path: "" }));
  expect(parseTurn("```\nLIST tests/fixtures\n```")).toStrictEqual(act({ kind: "list", path: "tests/fixtures" }));
});

test("Parse Turn example 4: ANSWER in a json fence, an extra key dropped; keys in the contract's order", () => {
  expect(parseTurn('Done.\nANSWER\n```json\n{"targets": ["src/x.ts"], "reasoning": "GREP found it", "acceptance": "npm test"}\n```'))
    .toStrictEqual(ans({ targets: ["src/x.ts"], context_slice: [], reasoning: "GREP found it" }));
  const got = parseTurn('ANSWER {"context_slice": ["c.ts"], "reasoning": "r", "targets": ["a.ts", "b.ts"]}');
  expect(got).toStrictEqual(ans({ targets: ["a.ts", "b.ts"], context_slice: ["c.ts"], reasoning: "r" }));
  expect(JSON.stringify(got)).toBe('{"kind":"answer","answer":{"targets":["a.ts","b.ts"],"context_slice":["c.ts"],"reasoning":"r"}}');
});

test("Parse Turn example 5: malformed turns — empty, no action, two actions, READ and GREP arguments", () => {
  expect(parseTurn(null)).toStrictEqual(bad("empty turn"));
  expect(parseTurn(" \n\t")).toStrictEqual(bad("empty turn"));
  const none = bad("no action: one line must start with READ, GREP, LIST or ANSWER");
  expect(parseTurn("The change is in src/a.ts")).toStrictEqual(none);
  expect(parseTurn("Read src/a.ts")).toStrictEqual(none);
  expect(parseTurn("READX a")).toStrictEqual(none);
  expect(parseTurn("READ src/a.ts\nGREP x")).toStrictEqual(bad("2 actions in one turn (READ, GREP): send one per turn"));
  expect(parseTurn("READ")).toStrictEqual(bad("READ needs a path"));
  expect(parseTurn("READ a.ts 9-3")).toStrictEqual(bad("READ: bad line range 9-3"));
  expect(parseTurn("READ a.ts 0-3")).toStrictEqual(bad("READ: bad line range 0-3"));
  expect(parseTurn("GREP ( -- src")).toStrictEqual(bad("GREP: invalid pattern /(/"));
  expect(parseTurn("GREP")).toStrictEqual(bad("GREP needs a pattern"));
});

test("Parse Turn example 6: malformed ANSWER turns", () => {
  expect(parseTurn("ANSWER the cage")).toStrictEqual(bad("ANSWER: no JSON object"));
  expect(parseTurn("ANSWER {targets: [a]}")).toStrictEqual(bad("ANSWER: the JSON does not parse"));
  const targets = bad("ANSWER: targets must be a non-empty list of paths");
  expect(parseTurn('ANSWER {"targets": []}')).toStrictEqual(targets);
  expect(parseTurn('ANSWER {"targets": ["a", ""]}')).toStrictEqual(targets);
  expect(parseTurn('ANSWER {"targets": ["a"], "context_slice": "b"}')).toStrictEqual(bad("ANSWER: context_slice must be a list of paths"));
  expect(parseTurn('ANSWER {"targets": ["a"], "reasoning": 5}')).toStrictEqual(bad("ANSWER: reasoning must be a string"));
});

test("§2.2 rows: VERBS; three actions counted in order; tab after a verb; ranges as numbers; GREP path trimmed", () => {
  expect([...VERBS]).toStrictEqual(["READ", "GREP", "LIST", "ANSWER"]);
  expect(parseTurn("LIST\nANSWER {}\n  GREP q")).toStrictEqual(bad("3 actions in one turn (LIST, ANSWER, GREP): send one per turn"));
  expect(parseTurn("READ\tsrc/t.ts")).toStrictEqual(act({ kind: "read", path: "src/t.ts", from: null, to: null }));
  expect(parseTurn("READ x.ts 08-010")).toStrictEqual(act({ kind: "read", path: "x.ts", from: 8, to: 10 }));
  expect(parseTurn("READ x.ts 3-")).toStrictEqual(act({ kind: "read", path: "x.ts 3-", from: null, to: null }));
  expect(parseTurn("GREP  a|b  --   lib dir  ")).toStrictEqual(act({ kind: "grep", pattern: "a|b", path: "lib dir" }));
  expect(parseTurn("GREP -- src")).toStrictEqual(act({ kind: "grep", pattern: "-- src", path: "" }));
  expect(parseTurn("GREP  -- src")).toStrictEqual(act({ kind: "grep", pattern: "-- src", path: "" }));
  expect(parseTurn("grep x\nLIST  src ")).toStrictEqual(act({ kind: "list", path: "src" }));
});

test("§2.2 rows: ANSWER on its own line, reasoning absent, a JSON array, braces in strings, prose after the object", () => {
  expect(parseTurn('ANSWER\n{"targets": ["q.ts"]}')).toStrictEqual(ans({ targets: ["q.ts"], context_slice: [], reasoning: "" }));
  expect(parseTurn('ANSWER [{"targets": ["q.ts"]}]')).toStrictEqual(ans({ targets: ["q.ts"], context_slice: [], reasoning: "" }));
  expect(parseTurn('ANSWER {"targets": ["q.ts"], "reasoning": "{x}"}')).toStrictEqual(ans({ targets: ["q.ts"], context_slice: [], reasoning: "{x}" }));
  expect(parseTurn('ANSWER {"targets": ["q.ts"]} - see {above}')).toStrictEqual(bad("ANSWER: the JSON does not parse"));
  expect(parseTurn("ANSWER }{")).toStrictEqual(bad("ANSWER: no JSON object"));
  expect(parseTurn('ANSWER {"targets": "q.ts"}')).toStrictEqual(bad("ANSWER: targets must be a non-empty list of paths"));
  expect(parseTurn('ANSWER {"targets": ["q.ts"], "context_slice": [""]}')).toStrictEqual(bad("ANSWER: context_slice must be a list of paths"));
  expect(parseTurn('ANSWER {"targets": ["q.ts"], "context_slice": [], "reasoning": null}')).toStrictEqual(bad("ANSWER: reasoning must be a string"));
  expect(parseTurn('ANSWER {"targets": ["q.ts", "q.ts"], "context_slice": ["q.ts"]}')).toStrictEqual(
    ans({ targets: ["q.ts", "q.ts"], context_slice: ["q.ts"], reasoning: "" }));
});
