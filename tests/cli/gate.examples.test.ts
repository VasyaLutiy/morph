import { expect, test } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import { main } from "../../src/cli/main.js";
import { fixtureJson, tmpRoot } from "../helpers.js";
import type { CliDeps, CliIo, ParseResult } from "../../src/cli/types.js";

// Parse Command 23: parseArgv.json["23"] holds the ten argv lists of `gate`, parse.json["23"] their results.
const argvLists = (): string[][] => (fixtureJson("cli/parseArgv.json") as Record<string, string[][]>)["23"];
const results = (): ParseResult[] => (fixtureJson("cli/parse.json") as Record<string, ParseResult[]>)["23"];

// Main 17: examples.json["Main 17"] is prose for a reader; the calls are typed here verbatim (§2.1 skeleton).
function io(): { io: CliIo; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: {
      stdout: (t) => {
        out.push(t);
      },
      stderr: (t) => {
        err.push(t);
      },
    },
    out,
    err,
  };
}
const cliDeps = (): CliDeps => ({ env: { PATH: process.env.PATH ?? "" }, now: () => 0, cwd: "/", transport: null });

const usage = (message: string): ParseResult => ({
  ok: false,
  error: { error: { code: 4, kind: "UsageError", message } },
});

test("Parse Command example 23: the gate command, its three value flags and its usage errors", () => {
  expect(parseCommand(argvLists()[0])).toStrictEqual(results()[0]);
  expect(argvLists().map((argv) => parseCommand(argv))).toStrictEqual(results());
});

test("Main example 17: gate is routed to Gate Command, a parse error stays Main's", async () => {
  const r = tmpRoot();
  try {
    const a = io();
    expect(
      await main(["gate", "--deck", "nope.json", "--stubs", "s", "--refs", "r", "--root", r.root], cliDeps(), a.io),
    ).toBe(4);
    expect(a.out).toStrictEqual(['{"error":{"code":4,"kind":"UsageError","message":"deck file not found: nope.json"}}\n']);
    expect(a.err).toStrictEqual(["morph gate: exit 4\n"]);

    const b = io();
    expect(await main(["gate", "--deck", "d.json", "--root", r.root], cliDeps(), b.io)).toBe(4);
    expect(b.out).toStrictEqual(['{"error":{"code":4,"kind":"UsageError","message":"missing --stubs"}}\n']);
    expect(b.err).toStrictEqual(["morph: missing --stubs\n"]);
  } finally {
    r.rm();
  }
});

test("Parse Command: --stubs and --refs are value flags that only gate takes", () => {
  expect(parseCommand(["run", "--deck", "d", "--processor", "p", "--stubs", "s"])).toStrictEqual(
    usage("flag --stubs does not apply to run"),
  );
  expect(parseCommand(["plan", "--spec", "c.yaml", "--refs", "r"])).toStrictEqual(
    usage("flag --refs does not apply to plan"),
  );
  expect(parseCommand(["deck", "check", "--deck", "d", "--refs", "r"])).toStrictEqual(
    usage("flag --refs does not apply to deck check"),
  );
  expect(parseCommand(["card", "--deck", "d", "--id", "x", "--stubs", "s"])).toStrictEqual(
    usage("flag --stubs does not apply to card"),
  );
  expect(parseCommand(["gate", "--refs"])).toStrictEqual(usage("flag --refs needs a value"));
  expect(parseCommand(["gate", "--deck", "d", "--stubs", "s", "--refs", "r", "--stubs", "t"])).toStrictEqual(
    usage("flag --stubs given twice"),
  );
});

test("Parse Command: gate's checks come in the parser's order", () => {
  // the extra word before a flag that does not apply
  expect(parseCommand(["gate", "x", "--processor", "p"])).toStrictEqual(usage("unexpected argument: x"));
  // a flag that does not apply before missing --deck
  expect(parseCommand(["gate", "--processor", "p"])).toStrictEqual(usage("flag --processor does not apply to gate"));
  // missing --deck before missing --stubs and --refs
  expect(parseCommand(["gate", "--refs", "r"])).toStrictEqual(usage("missing --deck"));
  expect(parseCommand(["gate"])).toStrictEqual(usage("missing --deck"));
  // missing --stubs before missing --refs
  expect(parseCommand(["gate", "--deck", "d"])).toStrictEqual(usage("missing --stubs"));
  // the gate command once every value is there, flags in any order
  expect(parseCommand(["gate", "--refs", "r", "--deck", "d", "--stubs", "s"])).toStrictEqual({
    ok: true,
    command: { name: "gate", root: ".", pretty: false, deck: "d", stubs: "s", refs: "r" },
  });
});

test("Parse Command: a gate command's keys come in the type's order and --root is kept as given", () => {
  const got = parseCommand(["gate", "--root", "rel/dir", "--deck", "d", "--stubs", "s", "--refs", "r"]);
  if (!got.ok) throw new Error(got.error.error.message);
  expect(Object.keys(got.command)).toStrictEqual(["name", "root", "pretty", "deck", "stubs", "refs"]);
  expect(got.command.root).toBe("rel/dir");
  expect(got.command.pretty).toBe(false);
});

test("Parse Command: the no-command message does not list gate", () => {
  const message =
    "no command (commands: deck check, plan, run, submit, collect, primer, scout, review, card, accept, init)";
  expect(parseCommand([])).toStrictEqual(usage(message));
  expect(parseCommand(["--pretty"])).toStrictEqual(usage(message));
  expect(parseCommand(["--stubs", "s", "--refs", "r"])).toStrictEqual(usage(message));
});

test("Main: gate hands the parsed stubs and refs to Gate Command and renders its document", async () => {
  const r = tmpRoot();
  try {
    r.write(
      "d.json",
      JSON.stringify([
        {
          customId: "x",
          intent: "generate",
          targets: ["src/x.txt"],
          contextSlice: [],
          instruction: "w",
          acceptance: null,
          model: null,
          maxTokens: null,
          reasoning: null,
          variants: 1,
          dependsOn: [],
        },
      ]),
    );
    const a = io();
    expect(await main(["gate", "--deck", "d.json", "--stubs", "s", "--refs", "f", "--root", r.root], cliDeps(), a.io)).toBe(4);
    expect(a.out).toStrictEqual(['{"error":{"code":4,"kind":"UsageError","message":"stubs directory not found: s"}}\n']);
    expect(a.err).toStrictEqual(["morph gate: exit 4\n"]);

    r.write("s/keep.txt", "");
    const b = io();
    expect(
      await main(["--pretty", "gate", "--deck", "d.json", "--stubs", "s", "--refs", "f", "--root", r.root], cliDeps(), b.io),
    ).toBe(4);
    expect(b.out).toStrictEqual([
      '{\n  "error": {\n    "code": 4,\n    "kind": "UsageError",\n    "message": "references directory not found: f"\n  }\n}\n',
    ]);
    expect(b.err).toStrictEqual(["morph gate: exit 4\n"]);
  } finally {
    r.rm();
  }
});
