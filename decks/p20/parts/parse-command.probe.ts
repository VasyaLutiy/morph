// P20 probe for parse-command by docs/TASK_P20_rerun.md §2.2 (src/cli/parse.ts, src/cli/types.ts) — `morph plan
// --only <ids>` (issue #11). Record Parse Command example 22 (tests/fixtures/cli/parseArgv.json / parse.json "22"),
// one assertion per argv, then a row: examples 1-21 unchanged.
import { test, expect } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import type { PlanArgs } from "../../src/cli/types.js";
import { fixtureJson } from "../../tests/helpers.js";

const ARGV = fixtureJson("cli/parseArgv.json") as Record<string, string[][]>;
const WANT = fixtureJson("cli/parse.json") as Record<string, unknown>;
const wantList = (k: string): unknown[] => (Array.isArray(WANT[k]) && ARGV[k].length > 1 ? (WANT[k] as unknown[]) : [WANT[k]]);

test("Parse Command example 22: plan --only, its value and its checks", () => {
  const want = wantList("22");
  expect(ARGV["22"].length).toBe(13);
  ARGV["22"].forEach((argv, i) => {
    expect([argv.join(" "), parseCommand(argv)]).toStrictEqual([argv.join(" "), want[i]]);
  });
  const typed: PlanArgs = { name: "plan", root: ".", pretty: false, spec: "s", components: [], map: null, judge: false, out: null, only: ["a"] };
  expect(typed.only).toStrictEqual(["a"]);
});

test("row: examples 1-21 give what they gave; no --only, no only key", () => {
  for (let n = 1; n <= 21; n++) {
    const k = String(n);
    const want = wantList(k);
    ARGV[k].forEach((argv, i) => {
      expect([k, argv.join(" "), parseCommand(argv)]).toStrictEqual([k, argv.join(" "), want[i]]);
    });
  }
  const r = parseCommand(["plan", "--spec", "s", "--checks", "c"]);
  expect(r.ok && "only" in r.command).toBe(false);
});
