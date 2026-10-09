import { expect, test } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import { fixtureJson } from "../helpers.js";
import type { ParseResult } from "../../src/cli/types.js";

function usage(message: string): ParseResult {
  return { ok: false, error: { error: { code: 4, kind: "UsageError", message } } };
}

test("Parse Command example 24: the word lists of parseArgv.json 24 parse to parse.json 24", () => {
  const argv = (fixtureJson("cli/parseArgv.json") as Record<string, string[][]>)["24"];
  const expected = (fixtureJson("cli/parse.json") as Record<string, ParseResult[]>)["24"];
  expect(argv.map((words) => parseCommand(words))).toStrictEqual(expected);
});

test("Parse Command example 24: --mutants 30 sits last on the gate command, absent without the flag", () => {
  const thirty = parseCommand(["gate", "--deck", "d.json", "--stubs", "s", "--refs", "r", "--mutants", "30"]);
  expect(thirty).toStrictEqual({
    ok: true,
    command: { name: "gate", root: ".", pretty: false, deck: "d.json", stubs: "s", refs: "r", mutants: 30 },
  });
  const plain = parseCommand(["gate", "--deck", "d.json", "--stubs", "s", "--refs", "r"]);
  expect(plain).toStrictEqual({
    ok: true,
    command: { name: "gate", root: ".", pretty: false, deck: "d.json", stubs: "s", refs: "r" },
  });
});

test("Parse Command example 24: flag order, --root and --pretty keep mutants 5", () => {
  const five = parseCommand([
    "gate",
    "--mutants",
    "5",
    "--refs",
    "r",
    "--stubs",
    "s",
    "--deck",
    "d.json",
    "--root",
    "/w",
    "--pretty",
  ]);
  expect(five).toStrictEqual({
    ok: true,
    command: { name: "gate", root: "/w", pretty: true, deck: "d.json", stubs: "s", refs: "r", mutants: 5 },
  });
});

test("Parse Command example 24: --mutants refuses 0 and x7", () => {
  const zero = parseCommand(["gate", "--deck", "d.json", "--stubs", "s", "--refs", "r", "--mutants", "0"]);
  expect(zero).toStrictEqual(usage("--mutants must be a positive integer (got '0')"));
  const x7 = parseCommand(["gate", "--deck", "d.json", "--stubs", "s", "--refs", "r", "--mutants", "x7"]);
  expect(x7).toStrictEqual(usage("--mutants must be a positive integer (got 'x7')"));
});

test("Parse Command example 24: gate still reports a missing --stubs, a missing value and a flag twice", () => {
  const missing = parseCommand(["gate", "--deck", "d.json", "--mutants", "3"]);
  expect(missing).toStrictEqual(usage("missing --stubs"));
  const noValue = parseCommand(["gate", "--deck", "d.json", "--stubs", "s", "--refs", "r", "--mutants"]);
  expect(noValue).toStrictEqual(usage("flag --mutants needs a value"));
  const twice = parseCommand(["gate", "--deck", "d.json", "--stubs", "s", "--refs", "r", "--mutants", "2", "--mutants", "3"]);
  expect(twice).toStrictEqual(usage("flag --mutants given twice"));
});

test("Parse Command example 24: --mutant-timeout does not apply to gate", () => {
  const timed = parseCommand(["gate", "--deck", "d.json", "--stubs", "s", "--refs", "r", "--mutant-timeout", "9"]);
  expect(timed).toStrictEqual(usage("flag --mutant-timeout does not apply to gate"));
});

test("Parse Command example 24: review keeps its own --mutants rule", () => {
  const reviewed = parseCommand(["review", "a", "b", "--mutants", "0"]);
  expect(reviewed).toStrictEqual(usage("--mutants must be a positive integer (got '0')"));
});
