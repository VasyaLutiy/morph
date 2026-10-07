// P10b2 probe for parse-command: parseCommand and PlanArgs by docs/TASK_P10b2_cli.md §2.2, one test per new record
// example (Component cli, Function Parse Command 12-13), then the §2.2 rows (the key is absent without --checks and
// last with it, the value taken whatever it is, the flag refused by deck check) and the types. Examples 1-11 stay in
// tests/cli/parse.examples.test.ts, which the full step runs.
import { test, expect, expectTypeOf } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import type { Command, ParseResult, PlanArgs } from "../../src/cli/types.js";

const usage = (message: string): ParseResult => ({ ok: false, error: { error: { code: 4, kind: "UsageError", message } } });

test("Parse Command example 12: plan with --checks", () => {
  expect(parseCommand(["plan", "--spec", "c.yaml", "--checks", "decks/p1/checks.json"])).toStrictEqual({ ok: true,
    command: { name: "plan", root: ".", pretty: false, spec: "c.yaml", components: [], map: null, judge: false, out: null,
      checks: "decks/p1/checks.json" } });
});

test("Parse Command example 13: --checks refused by run, without a value, given twice", () => {
  expect(parseCommand(["run", "--deck", "d", "--processor", "s", "--checks", "x"])).toStrictEqual(usage("flag --checks does not apply to run"));
  expect(parseCommand(["plan", "--checks"])).toStrictEqual(usage("flag --checks needs a value"));
  expect(parseCommand(["plan", "--checks", "a", "--checks", "b"])).toStrictEqual(usage("flag --checks given twice"));
});

test("§2.2: no --checks, no key; with it, the key comes last", () => {
  const plain = parseCommand(["plan", "--spec", "c.yaml"]);
  expect(plain).toStrictEqual({ ok: true, command: { name: "plan", root: ".", pretty: false, spec: "c.yaml", components: [],
    map: null, judge: false, out: null } });
  expect(plain.ok && "checks" in plain.command).toBe(false);
  const full = parseCommand(["--checks", "k.json", "plan", "--pretty", "--out", "d.json", "--spec", "c", "--component", "x",
    "--map", "m", "--judge", "--root", "/r"]);
  expect(full.ok ? Object.keys(full.command) : []).toStrictEqual(["name", "root", "pretty", "spec", "components", "map", "judge",
    "out", "checks"]);
  expect(full).toStrictEqual({ ok: true, command: { name: "plan", root: "/r", pretty: true, spec: "c", components: ["x"],
    map: "m", judge: true, out: "d.json", checks: "k.json" } });
});

test("§2.2: the value is the next token whatever it is; deck check and missing --spec", () => {
  expect(parseCommand(["plan", "--spec", "c", "--checks", "--judge"])).toStrictEqual({ ok: true, command: { name: "plan",
    root: ".", pretty: false, spec: "c", components: [], map: null, judge: false, out: null, checks: "--judge" } });
  expect(parseCommand(["deck", "check", "--deck", "d", "--checks", "x"])).toStrictEqual(usage("flag --checks does not apply to deck check"));
  expect(parseCommand(["plan", "--checks", "x"])).toStrictEqual(usage("missing --spec"));
  expect(parseCommand(["plan", "--checks=x", "--spec", "c"])).toStrictEqual(usage("unknown flag: --checks=x"));
  expect(parseCommand(["run", "--deck", "d", "--processor", "s"])).toStrictEqual({ ok: true, command: { name: "run", root: ".",
    pretty: false, deck: "d", processor: "s", runId: null, deadlineSeconds: 2400, maxCards: null, maxRetryBatches: 2 } });
});

test("§2.2: the types", () => {
  expectTypeOf<PlanArgs>().toEqualTypeOf<{
    name: "plan"; root: string; pretty: boolean; spec: string; components: string[]; map: string | null; judge: boolean;
    out: string | null; checks?: string;
  }>();
  expectTypeOf<Extract<Command, { name: "plan" }>>().toEqualTypeOf<PlanArgs>();
  expectTypeOf(parseCommand).returns.toEqualTypeOf<ParseResult>();
});
