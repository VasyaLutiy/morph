// P12a probe for parse-command by docs/TASK_P12_primer.md §2.2 (Parse Command, Main) — the word primer and the no-value
// flag --write; the no-command message lists six commands; main routes primer to Primer Command with env and now of its
// deps and classifies a git failure. Record Parse Command examples 8 (changed) and 16, Main example 9, then the §2.2 row.
import { test, expect } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import { main } from "../../src/cli/main.js";
import type { CliDeps, CliIo } from "../../src/cli/types.js";
import { fixtureJson, tmpRepo, tmpRoot } from "../../tests/helpers.js";

const usage = (message: string) => ({ ok: false, error: { error: { code: 4, kind: "UsageError", message } } });
function io(): CliIo & { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: (text) => { out.push(text); }, stderr: (text) => { err.push(text); } };
}
const DEPS: CliDeps = { env: { PATH: process.env.PATH ?? "" }, now: () => 1791400000000, cwd: "/", transport: null };

test("Parse Command example 8 (changed): no command lists six commands", () => {
  expect(parseCommand([]), "no command").toStrictEqual(usage("no command (commands: deck check, plan, run, submit, collect, primer)"));
});

test("Parse Command example 16: the word primer and --write", () => {
  const argv = fixtureJson("cli/parseArgv.json") as Record<string, string[][]>;
  const want = fixtureJson("cli/parse.json") as Record<string, unknown[]>;
  const got = argv["16"].map((a) => parseCommand(a));
  for (let i = 0; i < want["16"].length; i++) expect(got[i], `parse.json 16[${i}] for ${JSON.stringify(argv["16"][i])}`).toStrictEqual(want["16"][i]);
  expect(got.length, "six").toBe(6);
});

test("Main example 9: primer --write routed, then a git failure classified", async () => {
  const t = tmpRepo();
  const n = tmpRoot();
  try {
    t.write("tests/a.test.ts", 'test("a", () => {});\nit("b", () => {});\n');
    const o = io();
    expect(await main(["primer", "--write", "--root", t.root], DEPS, o), "exit").toBe(0);
    expect(o.out.length, "one chunk").toBe(1);
    const doc = JSON.parse(o.out[0]) as { tests: unknown; written: string; markdown: string };
    expect(doc.tests, "tests").toStrictEqual({ language: "typescript", files: 1, tests: 2 });
    expect(doc.written, "written").toBe(".morph/primer.md");
    expect(doc.markdown, "the file").toBe(t.read(".morph/primer.md"));
    expect(o.err, "stderr").toStrictEqual(["morph primer: exit 0\n"]);
    const p = io();
    expect(await main(["primer", "--root", n.root], DEPS, p), "exit 3").toBe(3);
    const e = JSON.parse(p.out[0]) as { error: { code: number; kind: string; message: string } };
    expect(`${e.error.code}|${e.error.kind}|${e.error.message.startsWith("git ls-files failed (exit 128): ")}`, "error").toBe("3|RuntimeError|true");
    expect(p.err, "stderr 3").toStrictEqual(["morph primer: exit 3\n"]);
  } finally {
    t.rm();
    n.rm();
  }
});

test("§2.2 rows: --write elsewhere, the old commands unchanged, now and env of the deps reach primer", async () => {
  expect(parseCommand(["run", "--deck", "d", "--processor", "s", "--write"]), "run").toStrictEqual(usage("flag --write does not apply to run"));
  expect(parseCommand(["primer", "--write", "x"]), "no value").toStrictEqual(usage("unexpected argument: x"));
  expect(parseCommand(["scout"]), "scout not yet").toStrictEqual({ ok: false, error: { error: { code: 4, kind: "NotYetError", message: "command scout is not available yet" } } });
  expect(parseCommand(["collect", "--batch", "b1", "--pretty"]), "collect").toStrictEqual({ ok: true, command: { name: "collect", root: ".", pretty: true, batch: "b1" } });
  expect(parseCommand(["submit", "--deck", "d", "--processor", "p"]), "submit").toStrictEqual({ ok: true, command: { name: "submit", root: ".", pretty: false, deck: "d", processor: "p" } });
  const t = tmpRepo();
  try {
    const o = io();
    expect(await main(["primer", "--pretty"], { ...DEPS, now: () => 5, cwd: t.root }, o), "exit").toBe(0);
    const doc = JSON.parse(o.out[0]) as { root: string; generatedAt: string; written: null };
    expect(`${doc.root === t.root}|${doc.generatedAt}|${doc.written}|${o.out[0].startsWith("{\n  \"root\"")}`, "cwd root, clock, pretty").toBe(
      "true|1970-01-01T00:00:00.005Z|null|true");
  } finally {
    t.rm();
  }
});
