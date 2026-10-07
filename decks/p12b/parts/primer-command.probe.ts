// P12b probe for primer-command by docs/TASK_P12b_primer.md §2.2 (Render Primer, Primer Command) — the card writes
// src/primer/renderPrimer.ts AND src/primer/primerCommand.ts (the digest's new keys break primerCommand.ts under tsc until
// the wiring lands, so the two are one card): the debt and running-total lines at the end of Runs, the File ownership
// section between Chronology and What is next, the caps 30 paths / 3 writes; git's Morph log folded into the ownership,
// MEASURE's running-total line quoted, both counted in the document. Render Primer examples 1-5 and the render rows, then
// Primer Command examples 3, 5, 6 and the command rows.
import { test, expect } from "vitest";
import path from "node:path";
import { primerCommand, runningLine } from "../../src/primer/primerCommand.js";
import type { PrimerDeps, PrimerDocument } from "../../src/primer/primerCommand.js";
import { fixture, fixtureJson, tmpRepo, tmpRoot } from "../../tests/helpers.js";
import type { TmpRepo } from "../../tests/helpers.js";
import { OWNERSHIP_PATHS, OWNERSHIP_WRITES, renderPrimer } from "../../src/primer/renderPrimer.js";
import type { DigestLine, DigestOwnership, PrimerDigest } from "../../src/primer/renderPrimer.js";

const DIGESTS = fixtureJson("primer/render.json") as Record<string, PrimerDigest>;
const D1 = DIGESTS["digest 1"];
const D2 = DIGESTS["digest 2"];
const PRIMER1 = fixture("primer/primer1.md");
const lines = (md: string): string[] => md.split("\n");
const line = (phase: string, cost: string): DigestLine => ({
  phase, date: "", builder: "night", models: [], written: null, planned: null, runs: 0, notes: "", cost, switches: [],
});
const own = (paths: number, writes: number): DigestOwnership => ({
  commits: 2,
  models: [{ model: "m/a", commits: 1 }, { model: "m/b", commits: 1 }],
  paths: Array.from({ length: paths }, (_, i) => ({
    path: `p/${i}.ts`,
    writes: Array.from({ length: writes }, (_, k) => ({ card: `c${k}`, model: "m/a", run: `r${k}` })),
  })),
});

test("Render Primer example 1: digest 1 is exactly primer1.md (11 033 chars)", () => {
  const md = renderPrimer(D1, 16000);
  expect(md).toBe(PRIMER1);
  expect(md.length).toBe(11033);
});

test("Render Primer example 2: digest 2 is exactly primer2.md", () => {
  expect(renderPrimer(D2, 16000)).toBe(fixture("primer/primer2.md"));
});

test("Render Primer example 3: the cut at 600 is unchanged (511 chars); cap = the length keeps it whole", () => {
  const head = PRIMER1.slice(0, 540);
  const cut = renderPrimer(D1, 600);
  expect(cut).toBe(head.slice(0, head.lastIndexOf("\n") + 1) + "_… truncated to fit 600 chars_\n");
  expect(cut.length).toBe(511);
  expect(renderPrimer(D1, PRIMER1.length)).toBe(PRIMER1);
});

test("Render Primer example 4: issues read and empty is still the last line", () => {
  const md = renderPrimer({ ...D2, story: { ...D2.story, issues: { state: "read", items: [] } } }, 16000);
  const ls = md.trimEnd().split("\n");
  expect(ls[ls.length - 1]).toBe("- none open");
});

test("Render Primer example 5: one commit with no model and no run, a debt with no cost, a running line without $", () => {
  const md = renderPrimer({
    ...D2,
    story: { ...D2.story, chronology: [line("P3 Debt (x)", ""), line("P4 debts", "1.5")] },
    ownership: { commits: 1, models: [{ model: "", commits: 1 }], paths: [{ path: "a b.ts", writes: [{ card: "k", model: "", run: null }] }] },
    running: "Running total: 12 runs",
  }, 16000);
  const ls = lines(md);
  expect(ls).toContain("- debt rows (docs/MEASURE.md), not in these totals: P3 Debt (x) $—");
  expect(ls).toContain("- running total (docs/MEASURE.md): \"Running total: 12 runs\" vs $0.0000 archived here — the two differ by runs made outside this repository (in MEASURE, no archive here) and archived runs MEASURE's total leaves out; debt rows are in neither");
  expect(ls).toContain("- git carries 1 Morph commit: — 1");
  expect(ls).toContain("- 1 path written by cards, most recent first; per path its cards, newest first:");
  expect(ls).toContain("- a b.ts ← k (—, run —)");
  const neg = renderPrimer({ ...D1, running: "Running total: $0.2000" }, 16000);
  expect(neg).toContain("- running total (docs/MEASURE.md): \"Running total: $0.2000\" vs $0.2651 archived here, difference -0.0651 — the two differ");
});

test("§2.2 render rows: the caps 30 and 3 exactly, the plurals, the section order, the debt word, the first $ amount", () => {
  expect(`${OWNERSHIP_PATHS}|${OWNERSHIP_WRITES}`).toBe("30|3");
  const at = (o: DigestOwnership): string[] => lines(renderPrimer({ ...D2, ownership: o }, 100000));
  const a = at(own(30, 3));
  expect(a).toContain("- git carries 2 Morph commits: m/a 1, m/b 1");
  expect(a).toContain("- 30 paths written by cards, most recent first; per path its cards, newest first:");
  expect(a).toContain("- p/29.ts ← c0 (m/a, run r0); c1 (m/a, run r1); c2 (m/a, run r2)");
  expect(a.some((l) => l.includes("more"))).toBe(false);
  const b = at(own(31, 4));
  expect(b).toContain("- p/0.ts ← c0 (m/a, run r0); c1 (m/a, run r1); c2 (m/a, run r2); … 1 more");
  expect(b).toContain("- … 1 more paths");
  expect(b.some((l) => l.startsWith("- p/30.ts"))).toBe(false);
  const md = renderPrimer(D1, 16000);
  const i = md.indexOf("## Chronology (docs/MEASURE.md)");
  const j = md.indexOf("## File ownership (git, Morph-Card trailers)\n\n- git carries 201 Morph commits: ");
  const k = md.indexOf("## What is next");
  expect(i < j && j < k && i > 0).toBe(true);
  const d = lines(renderPrimer({ ...D2, story: { ...D2.story, chronology: [line("indebted", "1"), line("P9 debt", "0.25"), line("P8 DEBT run", "2")] },
    running: "Running total $12 then $3" }, 16000));
  expect(d).toContain("- debt rows (docs/MEASURE.md), not in these totals: P9 debt $0.25, P8 DEBT run $2");
  expect(d.some((l) => l.startsWith("- running total (docs/MEASURE.md): \"Running total $12 then $3\" vs $0.0000 archived here, difference 12.0000 — "))).toBe(true);
  const none = lines(renderPrimer({ ...D2, story: { ...D2.story, chronology: [line("P1", "9")] } }, 16000));
  expect(none).toContain("- debt rows (docs/MEASURE.md): none");
  const runs = lines(renderPrimer(D1, 16000));
  const m = runs.findIndex((l) => l.startsWith("- models: "));
  expect(runs[m + 1].startsWith("- debt rows")).toBe(true);
  expect(runs[m + 2].startsWith("- running total")).toBe(true);
});

const ENV = { PATH: process.env.PATH ?? "" };
const deps = (now: number): PrimerDeps => ({ env: ENV, now: () => now });
const named = (text: string, root: string): string => text.split("{name}").join(path.basename(root));
const STORY: Record<string, string> = { "docs/MEASURE.md": "story/measure.md", "docs/PLAN.md": "story/plan.md",
  "docs/AUTONOMY.md": "story/autonomy.md", "docs/DECISIONS.md": "story/decisions.md", ".morph/issues.json": "story/issues.json" };
const RUNS = ["20261006-135524-8c114477", "20261007-092723-3c3f1c83", "20261007-111944", "20261007-155108", "20261007-204822"];
const TS_FILES: Record<string, string> = {
  "tests/a.test.ts": 'test("a", () => {});\ntest ("b", () => {});\n',
  "tests/b.spec.ts": 'it("c", () => {});\nit.skip("d", () => {});\ntest.todo("e");\nexpect(/x/.test("x")).toBe(true);\n',
  "src/c.ts": 'export const test = (s: string): string => s;\ntest("not a test file");\n',
};
const MEASURE = "# M\n\nRunning total of the stretch: $1.5000 of $9 (A $1 + B $0.5).\n\n| фаза | строитель | карт план/принято | $ исп. | прогоны |\n" +
  "|---|---|---|---|---|\n| P1 | night | 1 / 1 | 0.5 | |\n| P1 debt (agent) | claude -p | 1 / 1 | 2.25 | |\n";
const card = (r: TmpRepo, subject: string, trailers: string, files: Record<string, string>): void => {
  for (const [k, v] of Object.entries(files)) r.write(k, v);
  if (Object.keys(files).length > 0) r.git(["add", "--", ...Object.keys(files)]);
  r.git(["commit", "-q", "--allow-empty", "-m", subject, "-m", trailers]);
};

test("Primer Command example 3: the story repo, ownership 0/0, running null, written", () => {
  const t = tmpRepo();
  try {
    for (const [k, v] of Object.entries(STORY)) t.write(k, fixture("primer/" + v));
    for (const d of RUNS) t.write(".morph/runs/" + d + "/report.json", fixture("primer/runs/" + d + "/report.json"));
    t.write(".morph/runs/20261007-204822/answers/a.v1.answer.txt", "A");
    t.write(".morph/runs/20261007-204822/answers/lines.txt", "L");
    t.write(".morph/runs/broken/deck.json", "[]");
    for (const [k, v] of Object.entries(TS_FILES)) t.write(k, v);
    const r = primerCommand(t.root, true, deps(1791400000000));
    const { root, markdown, ...rest } = r.document;
    expect(root, "root").toBe(t.root);
    expect(rest, "command.json").toStrictEqual((fixtureJson("primer/command.json") as Record<string, unknown>)["Primer Command 3"]);
    expect(markdown, "primer3.md").toBe(named(fixture("primer/primer3.md"), t.root));
    expect(t.read(".morph/primer.md"), "written").toBe(markdown);
  } finally {
    t.rm();
  }
});

test("Primer Command example 5: an empty repository", () => {
  const t = tmpRepo();
  try {
    const d: PrimerDocument = primerCommand(t.root, false, deps(0)).document;
    expect(d.ownership, "ownership").toStrictEqual({ commits: 0, paths: 0 });
    expect(d.running, "running").toBe(null);
    expect(d.markdown, "primer5.md").toBe(named(fixture("primer/primer5.md"), t.root));
  } finally {
    t.rm();
  }
});

test("Primer Command example 6: two card commits and a run, a MEASURE with its running total and a debt row", () => {
  const t = tmpRepo();
  try {
    t.write("docs/MEASURE.md", MEASURE);
    card(t, "morph q: src/q.ts", "Morph-Card: q\nMorph-Model: m/q", { "src/q.ts": "export const q = 1;\n", "src/r.ts": "export const r = 2;\n" });
    card(t, "morph run 20261110-101010: deck and report", "Morph-Run: 20261110-101010", {});
    card(t, "morph q-judge: tests/q.test.ts", "Morph-Card: q-judge\nMorph-Model: m/r", { "tests/q.test.ts": 'test("q", () => {});\n' });
    const d = primerCommand(t.root, false, deps(1791400000000)).document;
    expect(d.ownership, "ownership").toStrictEqual({ commits: 2, paths: 3 });
    expect(d.running, "running").toBe("Running total of the stretch: $1.5000 of $9");
    const ls = d.markdown.split("\n");
    expect(ls, "debt").toContain("- debt rows (docs/MEASURE.md), not in these totals: P1 debt (agent) $2.25");
    expect(ls.some((l) => l.startsWith("- running total (docs/MEASURE.md): \"Running total of the stretch: $1.5000 of $9\" vs $0.0000 archived here, difference 1.5000 — ")), "running line").toBe(true);
    expect(ls, "commits").toContain("- git carries 2 Morph commits: m/r 1, m/q 1");
    expect(ls, "judge").toContain("- tests/q.test.ts ← q-judge (m/r, run —)");
    expect(ls, "code").toContain("- src/q.ts ← q (m/q, run 20261110-101010)");
    expect(ls, "second path").toContain("- src/r.ts ← q (m/q, run 20261110-101010)");
    expect(ls, "paths").toContain("- 3 paths written by cards, most recent first; per path its cards, newest first:");
    expect(runningLine(null), "null").toBe(null);
    expect(runningLine("x\n  Running total: $1 (a (b)\n"), "trimmed, cut").toBe("Running total: $1");
    expect(runningLine("Running total " + "y".repeat(250)), "long").toBe(("Running total " + "y".repeat(250)).slice(0, 199) + "…");
  } finally {
    t.rm();
  }
});

test("§2.2 command rows: the document's keys, the first line only, 200 chars kept whole, no line, not a repository", () => {
  const t = tmpRepo();
  const n = tmpRoot();
  try {
    const d = primerCommand(t.root, false, deps(7)).document;
    expect(Object.keys(d).join(","), "keys").toBe(
      "root,generatedAt,files,tests,runs,skipped,chronology,next,missing,issues,ownership,running,chars,written,markdown");
    expect(Object.keys(d.ownership).join(","), "ownership keys").toBe("commits,paths");
    expect(runningLine("a\nRunning totals: 1\nRunning total: 2 (z)\n"), "first starting line").toBe("Running totals: 1");
    expect(runningLine("Running total" + "w".repeat(187)), "200 whole").toBe("Running total" + "w".repeat(187));
    expect(runningLine("# M\n| Running total |\n"), "no line").toBe(null);
    expect(runningLine("Running total: $5 x(y)"), "a ( without its space").toBe("Running total: $5 x(y)");
    let message = "no throw";
    try {
      primerCommand(n.root, false, deps(0));
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    expect(message.startsWith("git ls-files failed (exit 128): "), `thrown: ${message}`).toBe(true);
  } finally {
    t.rm();
    n.rm();
  }
});
