// P35b probe for parse-command by docs/TASK_P35b_probes.md §2.2 (src/cli/types.ts, src/cli/parse.ts) — issue #45:
// the bare plan flag --write-probes. One test per row of parseArgv.json["26"]; unchanged row: plan without the flag
// has no writeProbes key (green on the stub, the current files).
import { test, expect } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import { fixtureJson } from "../../tests/helpers.js";

const ARGV = (fixtureJson("cli/parseArgv.json") as Record<string, string[][]>)["26"];
const WANT = (fixtureJson("cli/parse.json") as Record<string, unknown[]>)["26"];

for (let i = 0; i < ARGV.length; i++) {
  test("Parse Command example 26: row " + (i + 1) + " " + ARGV[i].join(" "), () => {
    expect(parseCommand(ARGV[i])).toStrictEqual(WANT[i]);
  });
}

test("Parse Command unchanged: plan without --write-probes has no writeProbes key", () => {
  expect(parseCommand(["plan", "--spec", "s", "--checks", "k.json"])).toStrictEqual({
    ok: true,
    command: { name: "plan", root: ".", pretty: false, spec: "s", components: [], map: null, judge: false, out: null, checks: "k.json" },
  });
});
