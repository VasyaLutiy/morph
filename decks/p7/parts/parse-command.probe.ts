// P7 probe for parse-command: parseCommand by docs/TASK_P7_cli.md §2.2, one test per record example
// (Component cli, Function Parse Command 1-8), then the §2.2 rows (the order of the checks, every
// numeric flag, the defaults) and the types.
import { test, expect, expectTypeOf } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import type { Command, ParseResult } from "../../src/cli/types.js";

const usage = (message: string): ParseResult => ({ ok: false, error: { error: { code: 4, kind: "UsageError", message } } });
const notYet = (message: string): ParseResult => ({ ok: false, error: { error: { code: 4, kind: "NotYetError", message } } });
const msg = (r: ParseResult): string => (r.ok ? "ok " + r.command.name : r.error.error.kind + ": " + r.error.error.message);

test("Parse Command example 1: deck check with the defaults", () => {
  expect(parseCommand(["deck", "check", "--deck", "d.json"])).toStrictEqual({ ok: true,
    command: { name: "deck check", root: ".", pretty: false, deck: "d.json", sliceCapBytes: 500000 } });
});

test("Parse Command example 2: run with every flag, global flags anywhere", () => {
  expect(parseCommand(["--pretty", "run", "--deck", "d.json", "--processor", "s", "--root", "/r", "--run-id", "r1",
    "--deadline", "60", "--max-cards", "3", "--max-retry-batches", "0"])).toStrictEqual({ ok: true,
    command: { name: "run", root: "/r", pretty: true, deck: "d.json", processor: "s", runId: "r1", deadlineSeconds: 60,
      maxCards: 3, maxRetryBatches: 0 } });
});

test("Parse Command example 3: an unknown command", () => {
  expect(parseCommand(["frobnicate"])).toStrictEqual(usage("unknown command: frobnicate"));
});

test("Parse Command example 4: commands of later phases answer not yet", () => {
  expect(parseCommand(["plan"])).toStrictEqual(notYet("command plan is not available yet"));
  expect(parseCommand(["deck", "status"])).toStrictEqual(notYet("command deck status is not available yet"));
});

test("Parse Command example 5: run without --processor", () => {
  expect(parseCommand(["run", "--deck", "d.json"])).toStrictEqual(usage("missing --processor"));
});

test("Parse Command example 6: a flag of another command", () => {
  expect(parseCommand(["deck", "check", "--deck", "d.json", "--processor", "s"])).toStrictEqual(
    usage("flag --processor does not apply to deck check"));
});

test("Parse Command example 7: a numeric flag out of range", () => {
  expect(parseCommand(["run", "--deck", "d", "--processor", "s", "--deadline", "0"])).toStrictEqual(
    usage("--deadline must be a positive integer (got '0')"));
});

test("Parse Command example 8: a value flag at the end; no command", () => {
  expect(parseCommand(["--root"])).toStrictEqual(usage("flag --root needs a value"));
  expect(parseCommand([])).toStrictEqual(usage("no command (commands: deck check, run)"));
});

test("§2.2: run defaults; flag value may start with a dash only through the value slot", () => {
  expect(parseCommand(["run", "--processor", "s", "--deck", "-x"])).toStrictEqual({ ok: true,
    command: { name: "run", root: ".", pretty: false, deck: "-x", processor: "s", runId: null, deadlineSeconds: 2400,
      maxCards: null, maxRetryBatches: 2 } });
  expect(msg(parseCommand(["deck", "check", "--deck", "d", "--slice-cap-bytes", "10", "--pretty", "--root", "x"]))).toBe("ok deck check");
});

test("§2.2: scan errors first, in argv order; repeated flag; unknown flag; = form", () => {
  expect(msg(parseCommand(["frobnicate", "--x"]))).toBe("UsageError: unknown flag: --x");
  expect(msg(parseCommand(["run", "--deck", "a", "--deck", "b"]))).toBe("UsageError: flag --deck given twice");
  expect(msg(parseCommand(["run", "--pretty", "--pretty"]))).toBe("UsageError: flag --pretty given twice");
  expect(msg(parseCommand(["run", "--root=x"]))).toBe("UsageError: unknown flag: --root=x");
  expect(msg(parseCommand(["run", "--help", "--root"]))).toBe("UsageError: unknown flag: --help");
});

test("§2.2: command words: deck alone, extra words, unknown deck subcommand, every not-yet word", () => {
  expect(msg(parseCommand(["deck"]))).toBe("UsageError: unknown command: deck");
  expect(msg(parseCommand(["deck", "frob", "x"]))).toBe("UsageError: unknown command: deck frob x");
  expect(msg(parseCommand(["run", "extra", "--deck", "d", "--processor", "s"]))).toBe("UsageError: unexpected argument: extra");
  expect(msg(parseCommand(["deck", "check", "more"]))).toBe("UsageError: unexpected argument: more");
  const later = ["scout", "primer", "review", "report"].map((w) => msg(parseCommand([w, "--deck", "d"])));
  expect(later.join(" | ")).toBe("NotYetError: command scout is not available yet | NotYetError: command primer is not available yet"
    + " | NotYetError: command review is not available yet | NotYetError: command report is not available yet");
  const deckLater = ["add", "reset", "clear"].map((w) => msg(parseCommand(["deck", w])));
  expect(deckLater.join(" | ")).toBe("NotYetError: command deck add is not available yet | NotYetError: command deck reset is"
    + " not available yet | NotYetError: command deck clear is not available yet");
});

test("§2.2: check order — command, then flags that do not apply, then --deck, then --processor, then numbers", () => {
  expect(msg(parseCommand(["run"]))).toBe("UsageError: missing --deck");
  expect(msg(parseCommand(["run", "--slice-cap-bytes", "x"]))).toBe("UsageError: flag --slice-cap-bytes does not apply to run");
  expect(msg(parseCommand(["deck", "check", "--run-id", "r"]))).toBe("UsageError: flag --run-id does not apply to deck check");
  expect(msg(parseCommand(["run", "--deck", "d", "--deadline", "x"]))).toBe("UsageError: missing --processor");
  expect(msg(parseCommand(["deck", "check"]))).toBe("UsageError: missing --deck");
});

test("§2.2: numeric flags and the run id", () => {
  const run = (...extra: string[]): string => msg(parseCommand(["run", "--deck", "d", "--processor", "s", ...extra]));
  expect(run("--max-cards", "0")).toBe("UsageError: --max-cards must be a positive integer (got '0')");
  expect(run("--max-retry-batches", "-1")).toBe("UsageError: --max-retry-batches must be a non-negative integer (got '-1')");
  expect(run("--deadline", "1.5")).toBe("UsageError: --deadline must be a positive integer (got '1.5')");
  expect(run("--deadline", "x", "--max-cards", "y")).toBe("UsageError: --deadline must be a positive integer (got 'x')");
  expect(run("--run-id", "a b")).toBe("UsageError: --run-id must match ^[A-Za-z0-9._-]+$ (got 'a b')");
  expect(run("--run-id", "a b", "--deadline", "0")).toBe("UsageError: --run-id must match ^[A-Za-z0-9._-]+$ (got 'a b')");
  expect(msg(parseCommand(["deck", "check", "--deck", "d", "--slice-cap-bytes", "0"]))).toBe(
    "UsageError: --slice-cap-bytes must be a positive integer (got '0')");
  expect(run("--max-retry-batches", "0")).toBe("ok run");
});

test("§2.2: the types", () => {
  expectTypeOf(parseCommand).toEqualTypeOf<(argv: string[]) => ParseResult>();
  expectTypeOf<Extract<Command, { name: "run" }>>().toEqualTypeOf<{ name: "run"; root: string; pretty: boolean; deck: string;
    processor: string; runId: string | null; deadlineSeconds: number; maxCards: number | null; maxRetryBatches: number }>();
  expectTypeOf<Extract<Command, { name: "deck check" }>>().toEqualTypeOf<{ name: "deck check"; root: string; pretty: boolean;
    deck: string; sliceCapBytes: number }>();
});
