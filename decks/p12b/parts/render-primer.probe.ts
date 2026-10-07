// P12b probe for render-primer by docs/TASK_P12b_primer.md §2.2 (Render Primer) — the debt and running-total lines at
// the end of Runs, the File ownership section between Chronology and What is next, the caps 30 paths / 3 writes with
// "… N more". Record Render Primer examples 1-5, then the §2.2 rows.
import { test, expect } from "vitest";
import { OWNERSHIP_PATHS, OWNERSHIP_WRITES, renderPrimer } from "../../src/primer/renderPrimer.js";
import type { DigestLine, DigestOwnership, PrimerDigest } from "../../src/primer/renderPrimer.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

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

test("§2.2 rows: the caps 30 and 3 exactly, the plurals, the section order, the debt word, the first $ amount", () => {
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
