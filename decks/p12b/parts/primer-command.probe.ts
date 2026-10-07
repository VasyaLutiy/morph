// P12b probe for primer-command by docs/TASK_P12b_primer.md §2.2 (Primer Command) — git's Morph log folded into the
// ownership, MEASURE's running-total line quoted, both handed to Render Primer and counted in the document. Record Primer
// Command examples 3, 5 and 6 (P12b), then the §2.2 rows.
import { test, expect } from "vitest";
import path from "node:path";
import { primerCommand, runningLine } from "../../src/primer/primerCommand.js";
import type { PrimerDeps, PrimerDocument } from "../../src/primer/primerCommand.js";
import { fixture, fixtureJson, tmpRepo, tmpRoot } from "../../tests/helpers.js";
import type { TmpRepo } from "../../tests/helpers.js";

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
    card(t, "morph q: src/q.ts", "Morph-Card: q\nMorph-Model: m/q", { "src/q.ts": "export const q = 1;\n" });
    card(t, "morph run 20261110-101010: deck and report", "Morph-Run: 20261110-101010", {});
    card(t, "morph q-judge: tests/q.test.ts", "Morph-Card: q-judge\nMorph-Model: m/r", { "tests/q.test.ts": 'test("q", () => {});\n' });
    const d = primerCommand(t.root, false, deps(1791400000000)).document;
    expect(d.ownership, "ownership").toStrictEqual({ commits: 2, paths: 2 });
    expect(d.running, "running").toBe("Running total of the stretch: $1.5000 of $9");
    const ls = d.markdown.split("\n");
    expect(ls, "debt").toContain("- debt rows (docs/MEASURE.md), not in these totals: P1 debt (agent) $2.25");
    expect(ls.some((l) => l.startsWith("- running total (docs/MEASURE.md): \"Running total of the stretch: $1.5000 of $9\" vs $0.0000 archived here, difference 1.5000 — ")), "running line").toBe(true);
    expect(ls, "commits").toContain("- git carries 2 Morph commits: m/r 1, m/q 1");
    expect(ls, "judge").toContain("- tests/q.test.ts ← q-judge (m/r, run —)");
    expect(ls, "code").toContain("- src/q.ts ← q (m/q, run 20261110-101010)");
    expect(runningLine(null), "null").toBe(null);
    expect(runningLine("x\n  Running total: $1 (a (b)\n"), "trimmed, cut").toBe("Running total: $1");
    expect(runningLine("Running total " + "y".repeat(250)), "long").toBe(("Running total " + "y".repeat(250)).slice(0, 199) + "…");
  } finally {
    t.rm();
  }
});

test("§2.2 rows: the document's keys, the first line only, 200 chars kept whole, no line, not a repository", () => {
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
