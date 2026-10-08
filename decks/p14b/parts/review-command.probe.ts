// P14b probe for review-command by docs/TASK_P14b_reviewer.md §2.2 (Review Command) — `morph review <base> <head>`: the
// refusals in order, git's diff (--no-renames, both -z calls), the range's Morph commits and the whole log's ownership,
// the test titles at head, the guardrails on the range's test files, the record's obligations, a scout session's scope,
// the mutants through Run Mutants, one Review document, --write under .morph/review/<b8>-<h8>/. Record Review Command
// examples 1-5, then the §2.2 rows.
import fs from "node:fs";
import { test, expect } from "vitest";
import { EMPTY_MAP, REVIEW_DIR, reviewCommand, reviewId, spreadMutants } from "../../src/reviewer/reviewCommand.js";
import type { ReviewOptions } from "../../src/reviewer/reviewCommand.js";
import type { Mutant } from "../../src/reviewer/planMutants.js";
import { fixture, tmpRepo, tmpRoot } from "../../tests/helpers.js";
import type { TmpRepo } from "../../tests/helpers.js";

const ADD_TAX = "export function addTax(price: number): number {\n  return price > 0 ? price + price / 5 : price;\n}\n";
const SCOUT_ID = "20261009-101500-0badc0de";
const env = { PATH: process.env.PATH ?? "" };
interface Tiny { t: TmpRepo; b0: string; h1: string; head: string }
function tiny(): Tiny {
  const t = tmpRepo();
  t.write("contour.yaml", fixture("reviewer/record.yaml"));
  t.write("morph-map.json", fixture("reviewer/map.json"));
  t.write("README.md", "till\n");
  t.write("tests/shop/old.test.ts", 'test("kept", () => {});\ntest("gone", () => {});\n');
  t.git(["add", "."]); t.git(["commit", "-q", "-m", "base"]); t.git(["tag", "b0"]);
  t.write("src/shop/addTax.ts", ADD_TAX);
  t.git(["add", "."]); t.git(["commit", "-q", "-m", "morph add-tax: src/shop/addTax.ts\n\nMorph-Card: add-tax\nMorph-Model: m/x"]);
  t.write("tests/shop/addTax.examples.test.ts", 'test("Add Tax example 1: the tax", () => {});\ntest("Add Tax example 3: negative", () => {});\n');
  t.git(["add", "."]);
  t.git(["commit", "-q", "-m", "morph add-tax-judge.r1: tests/shop/addTax.examples.test.ts\n\nMorph-Card: add-tax-judge.r1\nMorph-Model: m/x"]);
  t.write(".morph/runs/r7/report.json", "{}\n");
  t.git(["add", "-f", "."]); t.git(["commit", "-q", "-m", "morph run r7: deck and report\n\nMorph-Run: r7"]); t.git(["tag", "h1"]);
  t.write("README.md", "till v2\n");
  t.write("tests/shop/old.test.ts", 'test("kept", () => {});\ntest.skip("new", () => {});\n');
  t.git(["add", "."]); t.git(["commit", "-q", "-m", "hand"]);
  t.write(`.morph/scout/${SCOUT_ID}/scout.json`, JSON.stringify({ schema: 1, status: "ok", answer: { targets: ["src/shop/addTax.ts"],
    context_slice: ["README.md"], reasoning: "r" }, stopReason: "the model answered on its own" }, null, 2) + "\n");
  return { t, b0: t.git(["rev-parse", "b0"]), h1: t.git(["rev-parse", "h1"]), head: t.git(["rev-parse", "HEAD"]) };
}
const args = (over: Partial<ReviewOptions>): ReviewOptions => ({ base: "b0", head: "h1", spec: null, map: null, scout: null,
  mutants: null, mutantTimeoutSeconds: 120, test: null, write: false, ...over });
const usage = (message: string) => ({ code: 4, document: { error: { code: 4, kind: "UsageError", message } } });
const OBLIGATION = { kind: "obligation", source: "record: shop · Add Tax · example 2", path: "tests/shop/addTax.examples.test.ts",
  expected: 'a test named "Add Tax example 2"', got: "no test title at head starts with it" };
const byKind = (o: number, e: number, s: number, g: number, m: number) => ({ obligation: o, envelope: e, scope: s, guardrail: g, mutation: m });
const RC1_MD = "# Review b0..h1\n\n1 findings: obligation 1, envelope 0, scope 0, guardrail 0, mutation 0.\n\n## Changed files (3)\n\n" +
  "| file | status | lines | written by | scope |\n|---|---|---|---|---|\n| .morph/runs/r7/report.json | added | +1 -0 | — | — |\n" +
  "| src/shop/addTax.ts | added | +3 -0 | add-tax | — |\n| tests/shop/addTax.examples.test.ts | added | +2 -0 | add-tax-judge.r1 | — |\n\n" +
  "## Obligations (1 Functions, 3 examples, 1 missing)\n\n| Function | touched by | examples | missing |\n|---|---|---|---|\n" +
  "| shop · Add Tax | card add-tax-judge, card add-tax, file src/shop/addTax.ts, file tests/shop/addTax.examples.test.ts | 3 | 2 |\n\n" +
  "## Guardrails\n\n| guardrail | files | findings |\n|---|---|---|\n| Tests Kept | 0 | 0 |\n| No New Skips | 1 | 0 |\n\n## Findings\n\n" +
  "### F1 · obligation · record: shop · Add Tax · example 2\n\n- path: tests/shop/addTax.examples.test.ts\n" +
  "- EXPECTED: a test named \"Add Tax example 2\"\n- GOT: no test title at head starts with it\n";

test("Review Command example 1: a run range — one missing example, the envelope clean, the whole document", async () => {
  const { t, b0, h1 } = tiny();
  try {
    const got = await reviewCommand(t.root, args({ spec: "contour.yaml", map: "morph-map.json" }), { env });
    expect(got).toStrictEqual({ code: 1, document: { range: "b0..h1", verdict: "findings", base: b0, head: h1,
      counts: { files: 3, obligations: 1, examples: 3, missing: 1, mutants: null, killed: null, findings: 1, byKind: byKind(1, 0, 0, 0, 0) },
      findings: [{ id: "F1", ...OBLIGATION }], envelope: true, scout: null, commits: 3, morphCommits: 2, testFiles: 2, test: null,
      baseline: null, written: null, markdown: RC1_MD } });
  } finally {
    t.rm();
  }
});

test("Review Command example 2: the whole range with a scout scope, mutants and --write — nine findings, review.tiny.md", async () => {
  const { t, b0, head } = tiny();
  try {
    const got = await reviewCommand(t.root, args({ head: "HEAD", spec: "contour.yaml", map: "morph-map.json", scout: "latest", mutants: 5,
      mutantTimeoutSeconds: 30, test: 'grep -q "price > 0" src/shop/addTax.ts', write: true }), { env });
    expect(got.code).toBe(1);
    const doc = got.document as Record<string, unknown>;
    const env1 = (path: string) => ({ kind: "envelope", source: "primer: ownership", path, expected: "written by a Morph card of the range",
      got: "changed outside every card's targets; no Morph card ever wrote it" });
    const scope = (path: string, why: string) => ({ kind: "scope", source: "scout " + SCOUT_ID, path,
      expected: "a target of the scout session (src/shop/addTax.ts)", got: why });
    const want = [OBLIGATION, env1("README.md"), env1("tests/shop/old.test.ts"), scope("README.md", "changed, though the scout named it as context"),
      scope("tests/shop/addTax.examples.test.ts", "changed, though the scout did not name it"),
      scope("tests/shop/old.test.ts", "changed, though the scout did not name it"),
      { kind: "guardrail", source: "guardrail Tests Kept", path: "tests/shop/old.test.ts", expected: 'the test "gone" kept', got: "no test of that name at head" },
      { kind: "guardrail", source: "guardrail No New Skips", path: "tests/shop/old.test.ts", expected: "at most 0 skipped or focused tests, as at base", got: "1 at head" },
      { kind: "mutation", source: "mutation src/shop/addTax.ts:2", path: "src/shop/addTax.ts", expected: "a test fails on + → - at line 2", got: "every test passed" }];
    expect(doc.findings).toStrictEqual(want.map((f, i) => ({ id: "F" + (i + 1), ...f })));
    expect(doc.counts).toStrictEqual({ files: 5, obligations: 1, examples: 3, missing: 1, mutants: 2, killed: 1, findings: 9, byKind: byKind(1, 2, 3, 2, 1) });
    const dir = ".morph/review/" + b0.slice(0, 8) + "-" + head.slice(0, 8);
    expect([doc.range, doc.head, doc.envelope, doc.scout, doc.commits, doc.morphCommits, doc.testFiles, doc.test, doc.baseline, doc.written]).toStrictEqual(
      ["b0..HEAD", head, true, SCOUT_ID, 4, 2, 2, 'grep -q "price > 0" src/shop/addTax.ts', { exit: 0, timedOut: false }, dir]);
    expect(doc.markdown, "review.tiny.md").toBe(fixture("reviewer/review.tiny.md"));
    expect(t.read(dir + "/review.md")).toBe(fixture("reviewer/review.tiny.md"));
    expect(t.read(dir + "/review.json")).toBe(JSON.stringify(doc, null, 2) + "\n");
    expect(t.read("src/shop/addTax.ts"), "restored").toBe(ADD_TAX);
  } finally {
    t.rm();
  }
});

test("Review Command example 3: the refusals in order, each 4 UsageError; outside git the promise rejects", async () => {
  const { t, head } = tiny();
  const e = tmpRoot();
  try {
    const r = (over: Partial<ReviewOptions>) => reviewCommand(t.root, args(over), { env });
    expect(await r({ base: "nope" })).toStrictEqual(usage("not a commit: nope"));
    expect(await r({ head: "v9" })).toStrictEqual(usage("not a commit: v9"));
    expect(await r({ spec: "none.yaml" })).toStrictEqual(usage("spec file not found: none.yaml"));
    expect(await r({ map: "none.json" })).toStrictEqual(usage("map file not found: none.json"));
    expect(await r({ scout: "zz" })).toStrictEqual(usage("scout session not found: zz"));
    expect(await r({ mutants: 3 })).toStrictEqual(usage("--mutants needs the head to be the checkout HEAD (" + head.slice(0, 8) + ")"));
    t.write("notes.txt", "n\n");
    expect(await r({ head: "HEAD", mutants: 3 })).toStrictEqual(usage("--mutants needs a clean tree: dirty outside .morph/: notes.txt"));
    fs.rmSync(t.path("notes.txt"));
    t.git(["checkout", "-q", "-b", "side", "b0"]); t.write("x.txt", "x\n"); t.git(["add", "x.txt"]); t.git(["commit", "-q", "-m", "side"]);
    t.git(["checkout", "-q", "main"]);
    expect(await r({ head: "side" })).toStrictEqual(usage("head side is not in the history of HEAD"));
    await expect(reviewCommand(e.root, args({ base: "HEAD", head: "HEAD" }), { env })).rejects.toThrow(/^git rev-parse failed \(exit 128\): /);
  } finally {
    t.rm();
    e.rm();
  }
});

test("Review Command example 4: clean without a record; the default test command's red baseline; no code file, no run", async () => {
  const { t } = tiny();
  try {
    const clean = await reviewCommand(t.root, args({}), { env });
    expect(clean.code).toBe(0);
    const c = clean.document as { verdict: string; markdown: string; envelope: boolean };
    expect([c.verdict, c.envelope, c.markdown.startsWith("# Review b0..h1\n\nClean: no findings.\n")]).toStrictEqual(["clean", true, true]);
    const red = await reviewCommand(t.root, args({ head: "HEAD", mutants: 2 }), { env });
    const d = red.document as { test: string; baseline: unknown; findings: { source: string; got: string; expected: string }[]; markdown: string };
    expect([red.code, d.test, d.baseline]).toStrictEqual([1, "node_modules/.bin/vitest run --reporter=dot", { exit: 127, timedOut: false }]);
    expect(d.findings.at(-1)).toStrictEqual({ id: "F5", kind: "mutation", source: "mutation baseline", path: null,
      expected: "the test command passes before any mutant: node_modules/.bin/vitest run --reporter=dot", got: "exit 127" });
    expect(d.markdown.includes("## Mutants (0 of 0 killed)\n\n## Findings")).toBe(true);
    const none = await reviewCommand(t.root, args({ base: "h1", head: "HEAD", mutants: 3, test: "exit 9" }), { env });
    const n = none.document as { envelope: boolean; baseline: unknown; test: string; counts: { mutants: number; killed: number; findings: number } };
    expect([none.code, n.envelope, n.baseline, n.test, n.counts.mutants, n.counts.killed, n.counts.findings]).toStrictEqual([1, false, null, "exit 9", 0, 0, 2]);
  } finally {
    t.rm();
  }
});

test("Review Command example 5: reviewId, spreadMutants, REVIEW_DIR, EMPTY_MAP", () => {
  expect(reviewId("4f2a9c1e0b", "8a663b37ff")).toBe("4f2a9c1e-8a663b37");
  const eight: Mutant[] = Array.from({ length: 8 }, (_, i) => ({ path: "m.ts", line: i + 1, column: 1, rule: "r", text: "t" + i }));
  expect(spreadMutants(eight, 3).map((m) => m.line)).toStrictEqual([1, 3, 6]);
  expect(spreadMutants(eight, 0)).toStrictEqual([]);
  expect(spreadMutants(eight, 9)).toStrictEqual(eight);
  expect(REVIEW_DIR).toBe(".morph/review");
  expect(EMPTY_MAP).toStrictEqual({ version: 1, package: null, language: null, docs: [], groups: [], cards: [], extraCards: [] });
});

test("§2.2 rows: the scout session's refusals; a broken spec; the timeout in seconds kills; mutants spread over two files, tests and deletions skipped", async () => {
  const { t } = tiny();
  try {
    const r = (over: Partial<ReviewOptions>) => reviewCommand(t.root, args(over), { env });
    t.write(".morph/scout/20991231-000000-ffffffff/scout.json", "{");
    expect(await r({ scout: "latest" })).toStrictEqual(usage(".morph/scout/20991231-000000-ffffffff/scout.json does not parse"));
    t.write(".morph/scout/20991231-000000-ffffffff/scout.json", '{"schema": 2}');
    expect(await r({ scout: "latest" })).toStrictEqual(usage(".morph/scout/20991231-000000-ffffffff/scout.json: schema 2, expected 1"));
    t.write(".morph/scout/20991231-000000-ffffffff/scout.json", '{"schema": 1, "status": "no_answer", "answer": null, "stopReason": "why"}');
    expect(await r({ scout: "latest" })).toStrictEqual(usage("scout session 20991231-000000-ffffffff has no answer (no_answer): why"));
    expect((await r({ scout: SCOUT_ID })).document, "a named older session").toMatchObject({ scout: SCOUT_ID });
    fs.rmSync(t.path(".morph/scout"), { recursive: true });
    expect(await r({ scout: "latest" })).toStrictEqual(usage("no scout session under .morph/scout"));
    t.write("bad.yaml", "System: {}\n");
    const bad = await r({ spec: "bad.yaml" });
    expect([bad.code, JSON.stringify(bad.document).includes("bad.yaml is not a valid record")]).toStrictEqual([4, true]);
    t.write("lib/two.ts", "export const z = a && b;\n");
    t.write("tests/shop/t.test.ts", 'test("x", () => { expect(1 === 1).toBe(true); });\n');
    fs.rmSync(t.path("src/shop/addTax.ts"));
    t.git(["add", "-A"]); t.git(["commit", "-q", "-m", "more"]);
    t.write("lib/three.ts", "export const y = a || b;\nexport const w = p === q;\n");
    t.git(["add", "-A"]); t.git(["commit", "-q", "-m", "three"]);
    const spread = await r({ base: "h1", head: "HEAD", mutants: 3, test: 'if grep -q "a || b" lib/two.ts; then sleep 5; fi', mutantTimeoutSeconds: 1 });
    const d = spread.document as { markdown: string; counts: { mutants: number; killed: number } };
    expect([d.counts.mutants, d.counts.killed]).toStrictEqual([3, 1]);
    expect(d.markdown.includes("## Mutants (1 of 3 killed)\n\n| at | rule | result |\n|---|---|---|\n| lib/three.ts:1 | \\|\\| → && | survived |\n" +
      "| lib/three.ts:2 | === → !== | survived |\n| lib/two.ts:1 | && → \\|\\| | killed |\n")).toBe(true);
  } finally {
    t.rm();
  }
});
