import { expect, test } from "vitest";
import { parseTurn } from "../../src/scout/parseTurn.js";

test("Parse Turn example 1: a READ after prose, a path with a space, a range, a carriage return", () => {
  expect(
    parseTurn("I will check the cage first.\nREAD src/scout/cagePath.ts"),
  ).toStrictEqual({
    kind: "action",
    action: { kind: "read", path: "src/scout/cagePath.ts", from: null, to: null },
  });

  expect(parseTurn("READ lib/b one.ts 12-40")).toStrictEqual({
    kind: "action",
    action: { kind: "read", path: "lib/b one.ts", from: 12, to: 40 },
  });

  expect(parseTurn("  READ src/a.ts 7-7\r\n")).toStrictEqual({
    kind: "action",
    action: { kind: "read", path: "src/a.ts", from: 7, to: 7 },
  });
});

test("Parse Turn example 2: GREP split on the last ' -- ', no path, spaces in the pattern", () => {
  expect(parseTurn("GREP readOwnership|readMorphLog -- src/git")).toStrictEqual({
    kind: "action",
    action: { kind: "grep", pattern: "readOwnership|readMorphLog", path: "src/git" },
  });

  expect(parseTurn("GREP a -- b -- tests")).toStrictEqual({
    kind: "action",
    action: { kind: "grep", pattern: "a -- b", path: "tests" },
  });

  expect(parseTurn("GREP export function")).toStrictEqual({
    kind: "action",
    action: { kind: "grep", pattern: "export function", path: "" },
  });
});

test("Parse Turn example 3: LIST with and without a directory, inside a fence", () => {
  expect(parseTurn("LIST")).toStrictEqual({
    kind: "action",
    action: { kind: "list", path: "" },
  });

  expect(parseTurn("```\nLIST tests/fixtures\n```")).toStrictEqual({
    kind: "action",
    action: { kind: "list", path: "tests/fixtures" },
  });
});

test("Parse Turn example 4: ANSWER takes the first '{' to the last '}', extra keys dropped", () => {
  expect(
    parseTurn(
      "Done.\nANSWER\n```json\n{\"targets\": [\"src/x.ts\"], \"reasoning\": \"GREP found it\", \"acceptance\": \"npm test\"}\n```",
    ),
  ).toStrictEqual({
    kind: "answer",
    answer: { targets: ["src/x.ts"], context_slice: [], reasoning: "GREP found it" },
  });

  const second = parseTurn(
    "ANSWER {\"context_slice\": [\"c.ts\"], \"reasoning\": \"r\", \"targets\": [\"a.ts\", \"b.ts\"]}",
  );
  expect(second).toStrictEqual({
    kind: "answer",
    answer: { targets: ["a.ts", "b.ts"], context_slice: ["c.ts"], reasoning: "r" },
  });
  expect(JSON.stringify(second)).toBe(
    "{\"kind\":\"answer\",\"answer\":{\"targets\":[\"a.ts\",\"b.ts\"],\"context_slice\":[\"c.ts\"],\"reasoning\":\"r\"}}",
  );
});

test("Parse Turn example 5: the eleven malformed turns of the record, in order", () => {
  expect(parseTurn(null)).toStrictEqual({ kind: "malformed", reason: "empty turn" });
  expect(parseTurn(" \n\t")).toStrictEqual({ kind: "malformed", reason: "empty turn" });

  const noAction = {
    kind: "malformed",
    reason: "no action: one line must start with READ, GREP, LIST or ANSWER",
  };
  expect(parseTurn("The change is in src/a.ts")).toStrictEqual(noAction);
  expect(parseTurn("Read src/a.ts")).toStrictEqual(noAction);
  expect(parseTurn("READX a")).toStrictEqual(noAction);

  expect(parseTurn("READ src/a.ts\nGREP x")).toStrictEqual({
    kind: "malformed",
    reason: "2 actions in one turn (READ, GREP): send one per turn",
  });

  expect(parseTurn("READ")).toStrictEqual({
    kind: "malformed",
    reason: "READ needs a path",
  });
  expect(parseTurn("READ a.ts 9-3")).toStrictEqual({
    kind: "malformed",
    reason: "READ: bad line range 9-3",
  });
  expect(parseTurn("READ a.ts 0-3")).toStrictEqual({
    kind: "malformed",
    reason: "READ: bad line range 0-3",
  });
  expect(parseTurn("GREP ( -- src")).toStrictEqual({
    kind: "malformed",
    reason: "GREP: invalid pattern /(/",
  });
  expect(parseTurn("GREP")).toStrictEqual({
    kind: "malformed",
    reason: "GREP needs a pattern",
  });
});

test("Parse Turn example 6: ANSWER without an object, not parsing, and bad keys", () => {
  expect(parseTurn("ANSWER the cage")).toStrictEqual({
    kind: "malformed",
    reason: "ANSWER: no JSON object",
  });

  expect(parseTurn("ANSWER {targets: [a]}")).toStrictEqual({
    kind: "malformed",
    reason: "ANSWER: the JSON does not parse",
  });

  const badTargets = {
    kind: "malformed",
    reason: "ANSWER: targets must be a non-empty list of paths",
  };
  expect(parseTurn("ANSWER {\"targets\": []}")).toStrictEqual(badTargets);
  expect(parseTurn("ANSWER {\"targets\": [\"a\", \"\"]}")).toStrictEqual(badTargets);

  expect(parseTurn("ANSWER {\"targets\": [\"a\"], \"context_slice\": \"b\"}")).toStrictEqual({
    kind: "malformed",
    reason: "ANSWER: context_slice must be a list of paths",
  });

  expect(parseTurn("ANSWER {\"targets\": [\"a\"], \"reasoning\": 5}")).toStrictEqual({
    kind: "malformed",
    reason: "ANSWER: reasoning must be a string",
  });
});
