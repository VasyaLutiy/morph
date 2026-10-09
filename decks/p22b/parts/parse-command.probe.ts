// P22b probe for parse-command by docs/TASK_P22b_mutants.md §2.2 (src/cli/types.ts, src/cli/parse.ts) — gate --mutants.
// Record Parse Command example 24, then rows.
import { test, expect } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import type { ParseResult } from "../../src/cli/types.js";
import { fixtureJson } from "../../tests/helpers.js";

const argvLists = (): string[][] => (fixtureJson("cli/parseArgv.json") as Record<string, string[][]>)["24"];
const results = (): ParseResult[] => (fixtureJson("cli/parse.json") as Record<string, ParseResult[]>)["24"];

test("Parse Command example 24: gate --mutants, a positive integer, a key only when given", () => {
  expect(argvLists().map((argv) => parseCommand(argv))).toStrictEqual(results());
  expect(parseCommand(["gate", "--deck", "d", "--stubs", "s", "--refs", "r", "--mutants", "7"])).toStrictEqual({
    ok: true, command: { name: "gate", root: ".", pretty: false, deck: "d", stubs: "s", refs: "r", mutants: 7 } });
  expect(Object.keys((parseCommand(["gate", "--deck", "d", "--stubs", "s", "--refs", "r"]) as { ok: true; command: object }).command)).toStrictEqual(
    ["name", "root", "pretty", "deck", "stubs", "refs"]);
});
