import { expect, test } from "vitest";

import { parseCommand } from "../../src/cli/parse.js";
import type { Command } from "../../src/cli/types.js";

test("Parse Command example 1: deck check with the defaults", () => {
  const got = parseCommand(["deck", "check", "--deck", "d.json"]);
  const command: Command = {
    name: "deck check",
    root: ".",
    pretty: false,
    deck: "d.json",
    sliceCapBytes: 500000,
  };
  expect(got).toStrictEqual({ ok: true, command });
});

test("Parse Command example 2: run with every flag", () => {
  const got = parseCommand([
    "--pretty",
    "run",
    "--deck",
    "d.json",
    "--processor",
    "s",
    "--root",
    "/r",
    "--run-id",
    "r1",
    "--deadline",
    "60",
    "--max-cards",
    "3",
    "--max-retry-batches",
    "0",
  ]);
  const command: Command = {
    name: "run",
    root: "/r",
    pretty: true,
    deck: "d.json",
    processor: "s",
    runId: "r1",
    deadlineSeconds: 60,
    maxCards: 3,
    maxRetryBatches: 0,
  };
  expect(got).toStrictEqual({ ok: true, command });
});

test("Parse Command example 3: unknown command frobnicate", () => {
  const got = parseCommand(["frobnicate"]);
  expect(got).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "unknown command: frobnicate" } },
  });
});

test("Parse Command example 4: report and deck status answer NotYetError", () => {
  const report = parseCommand(["report"]);
  expect(report).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "NotYetError", message: "command report is not available yet" } },
  });
  const status = parseCommand(["deck", "status"]);
  expect(status).toStrictEqual({
    ok: false,
    error: {
      error: { code: 4, kind: "NotYetError", message: "command deck status is not available yet" },
    },
  });
});

test("Parse Command example 5: run without --processor", () => {
  const got = parseCommand(["run", "--deck", "d.json"]);
  expect(got).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "missing --processor" } },
  });
});

test("Parse Command example 6: --processor does not apply to deck check", () => {
  const got = parseCommand(["deck", "check", "--deck", "d.json", "--processor", "s"]);
  expect(got).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "flag --processor does not apply to deck check",
      },
    },
  });
});

test("Parse Command example 7: --deadline 0 is not a positive integer", () => {
  const got = parseCommand([
    "run",
    "--deck",
    "d",
    "--processor",
    "s",
    "--deadline",
    "0",
  ]);
  expect(got).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "--deadline must be a positive integer (got '0')",
      },
    },
  });
});

test("Parse Command example 8: --root as the last token, then no command", () => {
  const needsValue = parseCommand(["--root"]);
  expect(needsValue).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "flag --root needs a value" } },
  });
  const empty = parseCommand([]);
  expect(empty).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "no command (commands: deck check, plan, run, submit, collect, primer, scout, review)",
      },
    },
  });
});

test("Parse Command example 9: plan with every flag and a repeated --component", () => {
  const got = parseCommand([
    "plan",
    "--spec",
    "c.yaml",
    "--component",
    "a",
    "--map",
    "m.json",
    "--component",
    "b",
    "--judge",
    "--out",
    "d.json",
    "--pretty",
  ]);
  const command: Command = {
    name: "plan",
    root: ".",
    pretty: true,
    spec: "c.yaml",
    components: ["a", "b"],
    map: "m.json",
    judge: true,
    out: "d.json",
  };
  expect(got).toStrictEqual({ ok: true, command });
});

test("Parse Command example 10: plan with only --root and --spec", () => {
  const got = parseCommand(["plan", "--root", "/r", "--spec", "c.yaml"]);
  const command: Command = {
    name: "plan",
    root: "/r",
    pretty: false,
    spec: "c.yaml",
    components: [],
    map: null,
    judge: false,
    out: null,
  };
  expect(got).toStrictEqual({ ok: true, command });
});

test("Parse Command example 11: plan without --spec, --judge twice, --judge on run", () => {
  const missingSpec = parseCommand(["plan", "--component", "a"]);
  expect(missingSpec).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "missing --spec" } },
  });
  const twice = parseCommand(["plan", "--spec", "c", "--judge", "--judge"]);
  expect(twice).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "flag --judge given twice" } },
  });
  const notForRun = parseCommand(["run", "--deck", "d", "--processor", "s", "--judge"]);
  expect(notForRun).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "flag --judge does not apply to run" } },
  });
});

test("a flag given twice is refused", () => {
  const got = parseCommand(["run", "--deck", "d", "--deck", "e"]);
  expect(got).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "flag --deck given twice" } },
  });
});

test("a value flag takes the next token whatever it is", () => {
  const got = parseCommand(["deck", "check", "--deck", "--pretty"]);
  const command: Command = {
    name: "deck check",
    root: ".",
    pretty: false,
    deck: "--pretty",
    sliceCapBytes: 500000,
  };
  expect(got).toStrictEqual({ ok: true, command });
});

test("--help is an unknown flag", () => {
  const got = parseCommand(["run", "--deck", "d", "--processor", "s", "--help"]);
  expect(got).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "unknown flag: --help" } },
  });
});

test("deck frob x is an unknown command with every word", () => {
  const got = parseCommand(["deck", "frob", "x"]);
  expect(got).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "unknown command: deck frob x" } },
  });
});

test("an extra word after the command is unexpected", () => {
  const got = parseCommand(["run", "x", "--deck", "d", "--processor", "s"]);
  expect(got).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "unexpected argument: x" } },
  });
});

test("an invalid --run-id is refused", () => {
  const got = parseCommand([
    "run",
    "--deck",
    "d",
    "--processor",
    "s",
    "--run-id",
    "bad id",
  ]);
  expect(got).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "--run-id must match ^[A-Za-z0-9._-]+$ (got 'bad id')",
      },
    },
  });
});

test("a negative --max-retry-batches is refused", () => {
  const got = parseCommand([
    "run",
    "--deck",
    "d",
    "--processor",
    "s",
    "--max-retry-batches",
    "-1",
  ]);
  expect(got).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "--max-retry-batches must be a non-negative integer (got '-1')",
      },
    },
  });
});

test("a zero --slice-cap-bytes is refused", () => {
  const got = parseCommand(["deck", "check", "--deck", "d", "--slice-cap-bytes", "0"]);
  expect(got).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "--slice-cap-bytes must be a positive integer (got '0')",
      },
    },
  });
});

test("Parse Command example 14: submit and collect", () => {
  const got = parseCommand(["submit", "--deck", "d.json", "--processor", "b"]);
  const command: Command = {
    name: "submit",
    root: ".",
    pretty: false,
    deck: "d.json",
    processor: "b",
  };
  expect(got).toStrictEqual({ ok: true, command });

  const collect = parseCommand([
    "--pretty",
    "collect",
    "--batch",
    "batch-1791388269-cp5qOr5IQ0xoz1ntuc8W",
    "--root",
    "/r",
  ]);
  const collectCommand: Command = {
    name: "collect",
    root: "/r",
    pretty: true,
    batch: "batch-1791388269-cp5qOr5IQ0xoz1ntuc8W",
  };
  expect(collect).toStrictEqual({ ok: true, command: collectCommand });
});

test("Parse Command example 15: the usage errors of submit and collect", () => {
  const missingProcessor = parseCommand(["submit", "--deck", "d.json"]);
  expect(missingProcessor).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "missing --processor" } },
  });

  const missingDeck = parseCommand(["submit", "--processor", "b"]);
  expect(missingDeck).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "missing --deck" } },
  });

  const missingBatch = parseCommand(["collect"]);
  expect(missingBatch).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "missing --batch" } },
  });

  const badBatch = parseCommand(["collect", "--batch", "a/b"]);
  expect(badBatch).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "--batch must match ^[A-Za-z0-9._-]+$ (got 'a/b')",
      },
    },
  });

  const deckOnCollect = parseCommand(["collect", "--batch", "x", "--deck", "d"]);
  expect(deckOnCollect).toStrictEqual({
    ok: false,
    error: {
      error: { code: 4, kind: "UsageError", message: "flag --deck does not apply to collect" },
    },
  });

  const runIdOnSubmit = parseCommand(["submit", "--deck", "d", "--processor", "b", "--run-id", "r"]);
  expect(runIdOnSubmit).toStrictEqual({
    ok: false,
    error: {
      error: { code: 4, kind: "UsageError", message: "flag --run-id does not apply to submit" },
    },
  });

  const extra = parseCommand(["collect", "--batch", "x", "extra"]);
  expect(extra).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "unexpected argument: extra" } },
  });
});

test("Parse Command example 16: the word primer and --write", () => {
  const bare = parseCommand(["primer"]);
  const bareCommand: Command = {
    name: "primer",
    root: ".",
    pretty: false,
    write: false,
  };
  expect(bare).toStrictEqual({ ok: true, command: bareCommand });

  const flags = parseCommand(["primer", "--write", "--root", "/r", "--pretty"]);
  const flagsCommand: Command = {
    name: "primer",
    root: "/r",
    pretty: true,
    write: true,
  };
  expect(flags).toStrictEqual({ ok: true, command: flagsCommand });

  const deckOnPrimer = parseCommand(["primer", "--deck", "d.json"]);
  expect(deckOnPrimer).toStrictEqual({
    ok: false,
    error: {
      error: { code: 4, kind: "UsageError", message: "flag --deck does not apply to primer" },
    },
  });

  const extraWord = parseCommand(["primer", "x"]);
  expect(extraWord).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "unexpected argument: x" } },
  });

  const writeOnDeckCheck = parseCommand(["deck", "check", "--deck", "d.json", "--write"]);
  expect(writeOnDeckCheck).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "flag --write does not apply to deck check",
      },
    },
  });

  const writeTwice = parseCommand(["--write", "primer", "--write"]);
  expect(writeTwice).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "flag --write given twice" } },
  });
});

test("Parse Command example 17: the word scout and its flags", () => {
  const bare = parseCommand(["scout", "--processor", "ds", "--issue", "task.txt"]);
  const bareCommand: Command = {
    name: "scout",
    root: ".",
    pretty: false,
    processor: "ds",
    issue: "task.txt",
    seedFile: null,
    deadlineSeconds: 1800,
  };
  expect(bare).toStrictEqual({ ok: true, command: bareCommand });

  const flags = parseCommand([
    "--pretty",
    "scout",
    "--root",
    "/r",
    "--processor",
    "s",
    "--issue",
    "/tmp/q.md",
    "--seed-file",
    "seed.json",
    "--deadline",
    "90",
  ]);
  const flagsCommand: Command = {
    name: "scout",
    root: "/r",
    pretty: true,
    processor: "s",
    issue: "/tmp/q.md",
    seedFile: "seed.json",
    deadlineSeconds: 90,
  };
  expect(flags).toStrictEqual({ ok: true, command: flagsCommand });

  const missingProcessor = parseCommand(["scout", "--issue", "t"]);
  expect(missingProcessor).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "missing --processor" } },
  });

  const missingIssue = parseCommand(["scout", "--processor", "s"]);
  expect(missingIssue).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "missing --issue" } },
  });

  const badDeadline = parseCommand(["scout", "--processor", "s", "--issue", "t", "--deadline", "0"]);
  expect(badDeadline).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "--deadline must be a positive integer (got '0')",
      },
    },
  });

  const deckOnScout = parseCommand(["scout", "--processor", "s", "--issue", "t", "--deck", "d"]);
  expect(deckOnScout).toStrictEqual({
    ok: false,
    error: {
      error: { code: 4, kind: "UsageError", message: "flag --deck does not apply to scout" },
    },
  });

  const issueOnRun = parseCommand(["run", "--deck", "d", "--processor", "s", "--issue", "t"]);
  expect(issueOnRun).toStrictEqual({
    ok: false,
    error: {
      error: { code: 4, kind: "UsageError", message: "flag --issue does not apply to run" },
    },
  });
});

test("Parse Command example 18: plan --from-scout", () => {
  const bare = parseCommand(["plan", "--from-scout", "latest"]);
  const bareCommand: Command = {
    name: "plan --from-scout",
    root: ".",
    pretty: false,
    fromScout: "latest",
    out: null,
  };
  expect(bare).toStrictEqual({ ok: true, command: bareCommand });

  const flags = parseCommand([
    "plan",
    "--root",
    "/r",
    "--from-scout",
    "20261008-225320-74e423b1",
    "--out",
    "decks/s.json",
    "--pretty",
  ]);
  const flagsCommand: Command = {
    name: "plan --from-scout",
    root: "/r",
    pretty: true,
    fromScout: "20261008-225320-74e423b1",
    out: "decks/s.json",
  };
  expect(flags).toStrictEqual({ ok: true, command: flagsCommand });

  const specOnFromScout = parseCommand(["plan", "--from-scout", "x", "--spec", "c.yaml"]);
  expect(specOnFromScout).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "flag --spec does not apply to plan --from-scout",
      },
    },
  });

  const badId = parseCommand(["plan", "--from-scout", "a/b"]);
  expect(badId).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "--from-scout must match ^[A-Za-z0-9._-]+$ (got 'a/b')",
      },
    },
  });

  const needsValue = parseCommand(["plan", "--spec", "c.yaml", "--from-scout"]);
  expect(needsValue).toStrictEqual({
    ok: false,
    error: {
      error: { code: 4, kind: "UsageError", message: "flag --from-scout needs a value" },
    },
  });

  const judgeOnFromScout = parseCommand(["plan", "--from-scout", "x", "--judge"]);
  expect(judgeOnFromScout).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "flag --judge does not apply to plan --from-scout",
      },
    },
  });
});

test("Parse Command example 19: the word review, its refs and flags", () => {
  const bare = parseCommand(["review", "v1", "HEAD"]);
  const bareCommand: Command = {
    name: "review",
    root: ".",
    pretty: false,
    base: "v1",
    head: "HEAD",
    spec: null,
    map: null,
    scout: null,
    mutants: null,
    mutantTimeoutSeconds: 120,
    test: null,
    write: false,
  };
  expect(bare).toStrictEqual({ ok: true, command: bareCommand });

  const flags = parseCommand([
    "--pretty",
    "review",
    "4f2a9c1",
    "morph/20261009-101500",
    "--root",
    "/r",
    "--spec",
    "c.yaml",
    "--map",
    "m.json",
    "--scout",
    "latest",
    "--mutants",
    "8",
    "--mutant-timeout",
    "30",
    "--test",
    "npm test",
    "--write",
  ]);
  const flagsCommand: Command = {
    name: "review",
    root: "/r",
    pretty: true,
    base: "4f2a9c1",
    head: "morph/20261009-101500",
    spec: "c.yaml",
    map: "m.json",
    scout: "latest",
    mutants: 8,
    mutantTimeoutSeconds: 30,
    test: "npm test",
    write: true,
  };
  expect(flags).toStrictEqual({ ok: true, command: flagsCommand });

  const noRefs = parseCommand(["review"]);
  expect(noRefs).toStrictEqual({
    ok: false,
    error: {
      error: { code: 4, kind: "UsageError", message: "review needs two refs: <base> <head>" },
    },
  });

  const oneRef = parseCommand(["review", "a"]);
  expect(oneRef).toStrictEqual({
    ok: false,
    error: {
      error: { code: 4, kind: "UsageError", message: "review needs two refs: <base> <head>" },
    },
  });

  const threeRefs = parseCommand(["review", "a", "b", "c"]);
  expect(threeRefs).toStrictEqual({
    ok: false,
    error: { error: { code: 4, kind: "UsageError", message: "unexpected argument: c" } },
  });

  const zeroMutants = parseCommand(["review", "a", "b", "--mutants", "0"]);
  expect(zeroMutants).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "--mutants must be a positive integer (got '0')",
      },
    },
  });

  const badTimeout = parseCommand(["review", "a", "b", "--mutant-timeout", "x"]);
  expect(badTimeout).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "--mutant-timeout must be a positive integer (got 'x')",
      },
    },
  });

  const badScout = parseCommand(["review", "a", "b", "--scout", "a/b"]);
  expect(badScout).toStrictEqual({
    ok: false,
    error: {
      error: {
        code: 4,
        kind: "UsageError",
        message: "--scout must match ^[A-Za-z0-9._-]+$ (got 'a/b')",
      },
    },
  });

  const deckOnReview = parseCommand(["review", "a", "b", "--deck", "d"]);
  expect(deckOnReview).toStrictEqual({
    ok: false,
    error: {
      error: { code: 4, kind: "UsageError", message: "flag --deck does not apply to review" },
    },
  });

  const mutantsOnRun = parseCommand(["run", "--deck", "d", "--processor", "s", "--mutants", "3"]);
  expect(mutantsOnRun).toStrictEqual({
    ok: false,
    error: {
      error: { code: 4, kind: "UsageError", message: "flag --mutants does not apply to run" },
    },
  });

  const testOnPlan = parseCommand(["plan", "--spec", "c.yaml", "--test", "x"]);
  expect(testOnPlan).toStrictEqual({
    ok: false,
    error: {
      error: { code: 4, kind: "UsageError", message: "flag --test does not apply to plan" },
    },
  });
});
