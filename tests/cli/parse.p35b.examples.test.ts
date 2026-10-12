import { expect, test } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import { fixtureJson } from "../helpers.js";

const argv26 = fixtureJson("cli/parseArgv.json") as Record<string, string[][]>;
const parse26 = fixtureJson("cli/parse.json") as Record<string, unknown[]>;

test("Parse Command example 26: the nine --write-probes fixture cases", () => {
  const argvs = argv26["26"]!;
  const results = parse26["26"]!;
  expect(argvs.length).toBe(9);
  expect(results.length).toBe(9);
  for (let i = 0; i < 9; i++) {
    expect(parseCommand(argvs[i]!)).toStrictEqual(results[i]);
  }
});

test("Parse Command example 26: the plan --write-probes flag", () => {
  const result = parseCommand(["plan", "--spec", "s", "--checks", "k.json", "--write-probes"]);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(Object.keys(result.command).slice(-2)).toStrictEqual(["checks", "writeProbes"]);
  }
});

test("Parse Command example 26: --write-probes after --only", () => {
  const result = parseCommand([
    "plan",
    "--spec",
    "s",
    "--checks",
    "k.json",
    "--only",
    "a,b",
    "--write-probes",
  ]);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(Object.keys(result.command).slice(-3)).toStrictEqual(["checks", "only", "writeProbes"]);
  }
});

test("Parse Command example 26: --write-probes needs --checks", () => {
  expect(parseCommand(["plan", "--spec", "s", "--write-probes"])).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "--write-probes needs --checks",
      },
    },
  });
});

test("Parse Command example 26: --write-probes refuses --out", () => {
  expect(
    parseCommand(["plan", "--spec", "s", "--checks", "k.json", "--out", "d.json", "--write-probes"]),
  ).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "--write-probes writes no deck: drop --out",
      },
    },
  });
});

test("Parse Command example 26: --write-probes given twice", () => {
  expect(
    parseCommand([
      "plan",
      "--spec",
      "s",
      "--checks",
      "k.json",
      "--write-probes",
      "--write-probes",
    ]),
  ).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "flag --write-probes given twice",
      },
    },
  });
});

test("Parse Command example 26: --write-probes does not apply to run", () => {
  expect(parseCommand(["run", "--deck", "d", "--processor", "s", "--write-probes"])).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "flag --write-probes does not apply to run",
      },
    },
  });
});

test("Parse Command example 26: --write-probes does not apply to plan --from-scout", () => {
  expect(parseCommand(["plan", "--from-scout", "x", "--write-probes"])).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "flag --write-probes does not apply to plan --from-scout",
      },
    },
  });
});

test("Parse Command example 26: plan without --spec still names --spec", () => {
  expect(parseCommand(["plan", "--checks", "k.json", "--write-probes"])).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "missing --spec",
      },
    },
  });
});

test("Parse Command example 26: plan without --write-probes has no writeProbes key", () => {
  const result = parseCommand(["plan", "--spec", "s"]);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(Object.keys(result.command)).not.toContain("writeProbes");
  }
});
