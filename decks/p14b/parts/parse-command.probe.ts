// P14b probe for parse-command by docs/TASK_P14b_reviewer.md §2.2 (Parse Command, Main) — the word review with its two
// refs and its flags (--spec, --map, --scout, --mutants, --mutant-timeout, --test, --write), report the last not-yet
// word, the no-command message with eight commands; main routes review to Review Command with its deps. Record Parse
// Command examples 4 and 8 (changed) and 19, Main examples 12 and 13, then the §2.2 rows.
import { test, expect } from "vitest";
import { parseCommand } from "../../src/cli/parse.js";
import { main } from "../../src/cli/main.js";
import type { CliDeps, CliIo, Command } from "../../src/cli/types.js";
import { fixture, fixtureJson, tmpRepo, tmpRoot } from "../../tests/helpers.js";

const usage = (message: string) => ({ ok: false, error: { error: { code: 4, kind: "UsageError", message } } });
function io(): CliIo & { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: (text) => { out.push(text); }, stderr: (text) => { err.push(text); } };
}
const argv = fixtureJson("cli/parseArgv.json") as Record<string, string[][]>;
const want = fixtureJson("cli/parse.json") as Record<string, unknown[]>;
function byFixture(key: string, n: number): void {
  const got = argv[key].map((a) => parseCommand(a));
  expect(got.length, `${key}: ${n} argv`).toBe(n);
  for (let i = 0; i < n; i++) expect(got[i], `parse.json ${key}[${i}] for ${JSON.stringify(argv[key][i])}`).toStrictEqual(want[key][i]);
}

test("Parse Command examples 4 and 8 (changed): report is the not-yet word; no command lists eight", () => {
  byFixture("4", 2);
  byFixture("8", 2);
  expect(parseCommand([]), "no command").toStrictEqual(usage("no command (commands: deck check, plan, run, submit, collect, primer, scout, review)"));
  expect(parseCommand(["report"]), "report").toStrictEqual({ ok: false, error: { error: { code: 4, kind: "NotYetError", message: "command report is not available yet" } } });
});

test("Parse Command example 19: the word review, its two refs, flags and defaults", () => {
  byFixture("19", 11);
});

test("Main examples 12 and 13: review routed in process with its deps; its refusals and a git fault", async () => {
  const t = tmpRepo();
  const e = tmpRoot("morph-empty-");
  try {
    t.write("contour.yaml", fixture("reviewer/record.yaml"));
    t.write("morph-map.json", fixture("reviewer/map.json"));
    t.git(["add", "."]); t.git(["commit", "-q", "-m", "base"]); t.git(["tag", "b0"]);
    t.write("src/shop/addTax.ts", "export const addTax = (p: number): number => p * 1.2;\n");
    t.git(["add", "."]); t.git(["commit", "-q", "-m", "morph add-tax: src/shop/addTax.ts\n\nMorph-Card: add-tax\nMorph-Model: m/x"]); t.git(["tag", "h1"]);
    const deps: CliDeps = { env: { PATH: process.env.PATH ?? "" }, now: () => 0, cwd: t.root, transport: null };
    const o = io();
    expect(await main(["review", "b0", "h1", "--spec", "contour.yaml", "--map", "morph-map.json"], deps, o), "exit").toBe(1);
    expect(o.out.length, "one chunk").toBe(1);
    const doc = JSON.parse(o.out[0]) as { range: string; verdict: string; counts: { findings: number; missing: number } };
    expect([doc.range, doc.verdict, doc.counts.missing, doc.counts.findings]).toStrictEqual(["b0..h1", "findings", 3, 3]);
    expect(o.err).toStrictEqual(["morph review: exit 1\n"]);
    const p = io();
    expect(await main(["review", "b0", "h1", "--root", t.root, "--pretty"], { ...deps, cwd: "/" }, p)).toBe(0);
    expect(p.out[0].startsWith('{\n  "range": "b0..h1",\n  "verdict": "clean",'), "pretty").toBe(true);
    expect(p.err).toStrictEqual(["morph review: exit 0\n"]);
    const q = io();
    expect(await main(["review", "HEAD", "--root", t.root], deps, q)).toBe(4);
    expect(q.out).toStrictEqual(['{"error":{"code":4,"kind":"UsageError","message":"review needs two refs: <base> <head>"}}\n']);
    expect(q.err).toStrictEqual(["morph: review needs two refs: <base> <head>\n"]);
    const r = io();
    expect(await main(["review", "nope", "HEAD", "--root", t.root], deps, r)).toBe(4);
    expect(JSON.parse(r.out[0])).toStrictEqual({ error: { code: 4, kind: "UsageError", message: "not a commit: nope" } });
    expect(r.err).toStrictEqual(["morph review: exit 4\n"]);
    const s = io();
    expect(await main(["review", "HEAD", "HEAD", "--root", e.root], deps, s)).toBe(3);
    const fault = JSON.parse(s.out[0]) as { error: { code: number; kind: string; message: string } };
    expect([fault.error.code, fault.error.kind, fault.error.message.startsWith("git rev-parse failed (exit 128): ")]).toStrictEqual([3, "RuntimeError", true]);
    expect(s.err).toStrictEqual(["morph review: exit 3\n"]);
  } finally {
    t.rm();
    e.rm();
  }
});

test("§2.2 rows: review's keys and defaults in order; a value flag eats the next token; the checks' order", () => {
  const ok = parseCommand(["review", "x", "y", "--test", "--write"]);
  expect(ok).toStrictEqual({ ok: true, command: { name: "review", root: ".", pretty: false, base: "x", head: "y", spec: null, map: null,
    scout: null, mutants: null, mutantTimeoutSeconds: 120, test: "--write", write: false } satisfies Command });
  if (ok.ok) expect(Object.keys(ok.command)).toStrictEqual(["name", "root", "pretty", "base", "head", "spec", "map", "scout", "mutants",
    "mutantTimeoutSeconds", "test", "write"]);
  expect(parseCommand(["review", "a", "--mutants", "0"])).toStrictEqual(usage("review needs two refs: <base> <head>"));
  expect(parseCommand(["review", "a", "b", "--mutants", "x", "--scout", "a b"])).toStrictEqual(usage("--scout must match ^[A-Za-z0-9._-]+$ (got 'a b')"));
  expect(parseCommand(["review", "a", "b", "--mutant-timeout", "0", "--mutants", "-1"])).toStrictEqual(usage("--mutants must be a positive integer (got '-1')"));
  expect(parseCommand(["review", "a", "b", "--mutants", "12", "--mutant-timeout", "7"])).toMatchObject({ ok: true, command: { mutants: 12, mutantTimeoutSeconds: 7 } });
  expect(parseCommand(["review", "a", "b", "--processor", "ds"])).toStrictEqual(usage("flag --processor does not apply to review"));
  expect(parseCommand(["scout", "--processor", "s", "--issue", "t", "--scout", "x"])).toStrictEqual(usage("flag --scout does not apply to scout"));
});
