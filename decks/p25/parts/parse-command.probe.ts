// P25 probe for parse-command by docs/TASK_P25_config.md §2.2 (src/cli/types.ts, parse.ts) — issue #18 item 4:
// scout without --deadline gives deadlineSeconds null (Main's config gives it). Record Parse Command example 17
// (changed); example 25 (P24b) green on main by design.
import { test, expect } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import { fixtureJson } from "../../tests/helpers.js";

const row = (n: string): [string[][], unknown[]] => [
  (fixtureJson("cli/parseArgv.json") as Record<string, string[][]>)[n],
  (fixtureJson("cli/parse.json") as Record<string, unknown[]>)[n],
];

test("Parse Command example 17: the word scout and its flags; no --deadline gives null", () => {
  const [argv, want] = row("17");
  expect(argv.map((a) => parseCommand(a))).toStrictEqual(want);
  expect(parseCommand(["scout", "--processor", "ds", "--issue", "task.txt"])).toStrictEqual({ ok: true, command: {
    name: "scout", root: ".", pretty: false, processor: "ds", issue: "task.txt", seedFile: null, deadlineSeconds: null } });
  expect(parseCommand(["run", "--deck", "d.json", "--processor", "s"])).toStrictEqual({ ok: true, command: {
    name: "run", root: ".", pretty: false, deck: "d.json", processor: "s", runId: null, deadlineSeconds: 2400, maxCards: null,
    maxRetryBatches: 2 } });
});

test("Parse Command example 25: accept takes an id list, --from-run and --pick; card does not (green on main)", () => {
  const [argv, want] = row("25");
  expect(argv.map((a) => parseCommand(a))).toStrictEqual(want);
});
