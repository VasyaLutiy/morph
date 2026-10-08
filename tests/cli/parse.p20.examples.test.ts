import { expect, test } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import type { Command } from "../../src/cli/types.js";

test("Parse Command example 22: the plan --only flag", () => {
  const joinedIds: Command = {
    name: "plan",
    root: ".",
    pretty: false,
    spec: "c.yaml",
    components: [],
    map: null,
    judge: false,
    out: null,
    only: ["a", "b.v_2"],
  };
  expect(parseCommand(["plan", "--spec", "c.yaml", "--only", "a,b.v_2"])).toStrictEqual({
    ok: true,
    command: joinedIds,
  });

  const withChecks: Command = {
    name: "plan",
    root: "/r",
    pretty: true,
    spec: "s",
    components: ["q"],
    map: null,
    judge: true,
    out: null,
    checks: "k.json",
    only: ["x-9"],
  };
  expect(
    parseCommand([
      "--pretty",
      "plan",
      "--only",
      "x-9",
      "--root",
      "/r",
      "--spec",
      "s",
      "--checks",
      "k.json",
      "--judge",
      "--component",
      "q",
    ]),
  ).toStrictEqual({ ok: true, command: withChecks });

  const keptOrder: Command = {
    name: "plan",
    root: ".",
    pretty: false,
    spec: "s",
    components: [],
    map: null,
    judge: false,
    out: null,
    only: ["b", "a", "c"],
  };
  expect(parseCommand(["plan", "--spec", "s", "--only", "b,a,c"])).toStrictEqual({
    ok: true,
    command: keptOrder,
  });

  expect(parseCommand(["plan", "--spec", "s", "--only", "a,,b"])).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "--only must be distinct card ids joined by \",\" (got 'a,,b')",
      },
    },
  });

  expect(parseCommand(["plan", "--spec", "s", "--only", "p,q,p"])).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "--only must be distinct card ids joined by \",\" (got 'p,q,p')",
      },
    },
  });

  expect(parseCommand(["plan", "--spec", "s", "--only", "a b"])).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "--only must be distinct card ids joined by \",\" (got 'a b')",
      },
    },
  });

  expect(parseCommand(["plan", "--spec", "s", "--only", ""])).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "--only must be distinct card ids joined by \",\" (got '')",
      },
    },
  });

  expect(parseCommand(["plan", "--spec", "s", "--only", "a/b"])).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "--only must be distinct card ids joined by \",\" (got 'a/b')",
      },
    },
  });

  expect(parseCommand(["plan", "--only", "a"])).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "missing --spec",
      },
    },
  });

  expect(parseCommand(["plan", "--spec", "s", "--only"])).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "flag --only needs a value",
      },
    },
  });

  expect(parseCommand(["plan", "--spec", "s", "--only", "a", "--only", "b"])).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "flag --only given twice",
      },
    },
  });

  expect(parseCommand(["run", "--deck", "d", "--processor", "s", "--only", "a"])).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "flag --only does not apply to run",
      },
    },
  });

  expect(parseCommand(["plan", "--from-scout", "x", "--only", "a"])).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "flag --only does not apply to plan --from-scout",
      },
    },
  });
});
