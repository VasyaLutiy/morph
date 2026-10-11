import { test, expect } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";

test("Parse Command example 12: --checks gives the plan command a checks key", () => {
  const r = parseCommand(["plan", "--spec", "c.yaml", "--checks", "decks/p1/checks.json"]);
  expect(r).toStrictEqual({
    ok: true,
    command: {
      name: "plan",
      root: ".",
      pretty: false,
      spec: "c.yaml",
      components: [],
      map: null,
      judge: false,
      out: null,
      checks: "decks/p1/checks.json",
    },
  });
});

test("Parse Command example 13: --checks does not apply to run, needs a value, and cannot be given twice", () => {
  const a = parseCommand(["run", "--deck", "d", "--processor", "s", "--checks", "x"]);
  expect(a).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "flag --checks does not apply to run" } },
  });
  const b = parseCommand(["plan", "--checks"]);
  expect(b).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "flag --checks needs a value" } },
  });
  const c = parseCommand(["plan", "--checks", "a", "--checks", "b"]);
  expect(c).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "flag --checks given twice" } },
  });
});
