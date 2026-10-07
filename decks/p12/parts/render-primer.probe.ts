// P12a probe for render-primer by docs/TASK_P12_primer.md §2.2 (Render Primer) — the markdown's sections and line formats
// exactly as primer1.md and primer2.md show them, every empty form, the cut at the cap. Record Render Primer examples
// 1-4, then the §2.2 row.
import { test, expect } from "vitest";
import { renderPrimer } from "../../src/primer/renderPrimer.js";
import type { PrimerDigest } from "../../src/primer/renderPrimer.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

const digest = (k: string): PrimerDigest => (fixtureJson("primer/render.json") as Record<string, PrimerDigest>)[k];
const lines = (s: string): string[] => s.split("\n");

test("Render Primer example 1: the real digest renders primer1.md", () => {
  const got = renderPrimer(digest("digest 1"), 16000);
  const want = fixture("primer/primer1.md");
  const g = lines(got);
  const w = lines(want);
  for (let i = 0; i < Math.max(g.length, w.length); i++) expect(g[i], `primer1.md line ${i + 1}`).toBe(w[i]);
  expect(got.length, "5952 chars").toBe(5952);
});

test("Render Primer example 2: the empty digest renders primer2.md", () => {
  const got = renderPrimer(digest("digest 2"), 16000);
  const g = lines(got);
  const w = lines(fixture("primer/primer2.md"));
  for (let i = 0; i < Math.max(g.length, w.length); i++) expect(g[i], `primer2.md line ${i + 1}`).toBe(w[i]);
});

test("Render Primer example 3: the cut at the cap", () => {
  const full = fixture("primer/primer1.md");
  const cut = renderPrimer(digest("digest 1"), 600);
  const head = full.slice(0, 540);
  expect(cut, "cap 600").toBe(head.slice(0, head.lastIndexOf("\n") + 1) + "_… truncated to fit 600 chars_\n");
  expect(cut.length, "511 chars").toBe(511);
  expect(renderPrimer(digest("digest 1"), 5952), "cap = its length").toBe(full);
});

test("Render Primer example 4: issues read empty, unreadable; next and decisions set", () => {
  const d = digest("digest 2");
  const a = lines(renderPrimer({ ...d, story: { ...d.story, issues: { state: "read", items: [] } } }, 16000));
  expect(a[a.length - 2], "none open").toBe("- none open");
  const b = lines(renderPrimer({ ...d, story: { ...d.story, issues: { state: "unreadable", items: [] } } }, 16000));
  expect(b[b.length - 2], "unreadable").toBe("- not read: .morph/issues.json is not a JSON array");
  const c = renderPrimer({ ...d, story: { ...d.story, next: { phase: "P7", row: "P7 · cli · x", handoff: ["H", "Next: P8"] }, decisions: ["a · b"] } }, 16000);
  expect(c, "next and handoff").toContain("## What is next\n\n- next phase (docs/PLAN.md): P7 · cli · x\n- handoff (docs/AUTONOMY.md):\n  > H\n  > Next: P8\n\n");
  expect(c, "decisions").toContain("## Last decisions (docs/DECISIONS.md)\n\n- a · b\n\n");
});

test("§2.2 rows: one run, a priced and an unpriced form, a line without models or notes, issues with and without labels", () => {
  const d = digest("digest 2");
  const totals = { ...d.runs.totals, runs: 1, v2: { runs: 1, cards: 2, written: 1, cost: 0.123456 }, cards: 2, written: 1, failed: 1,
    requests: 3, answers: 2, cost: 0.123456, unpriced: 0, models: [{ model: "q/r", runs: 1 }], from: "2026-12-01", to: "2026-12-01" };
  const story = { ...d.story, missing: ["plan"], chronology: [
    { phase: "P1", date: "", builder: "", models: [], written: null, planned: null, runs: 1, notes: "", cost: "", switches: [] },
    { phase: "P2", date: "2026-12-01", builder: "b", models: ["q/r", "s/t"], written: 0, planned: 2, runs: 2, notes: "n", cost: "0.5", switches: ["x", "y"] }],
    issues: { state: "read" as const, items: [{ number: 7, title: "t u", labels: [] }, { number: 8, title: "v", labels: ["a", "b"] }] } };
  const got = renderPrimer({ ...d, name: "zz", generatedAt: "G", files: 3, tests: { language: "typescript", files: 1, tests: 1 },
    runs: { skipped: [], totals }, story }, 16000);
  expect(got, "head").toContain("# Primer: zz\n\ngenerated G · 3 files in the tree · no model call, no network\nmissing: docs/PLAN.md\n\n## Tests\n\n- 1 tests in 1 test files by the typescript profile");
  expect(got, "runs").toContain("- archived runs: 1 (V2 1, mrph 0), 2026-12-01 → 2026-12-01\n- cards: 1 written of 2 (1 failed, 0 skipped); requests 3, answers kept 2\n" +
    "- cost: $0.1235 over 1 priced runs (0 unpriced)\n- by format: V2 1 runs, 1/2 written, $0.1235; mrph 0 runs, 0/0 written, $0.0000\n- models: q/r (1 run)\n\n## Chronology");
  expect(got, "chronology").toContain("- P1 · — · — · — · — · 1 run · $—\n- P2 · 2026-12-01 · b · q/r, s/t · 0/2 written · 2 runs · $0.5 · n ← switch: x; y\n\n## What is next");
  expect(got.endsWith("- #7 t u\n- #8 v [a, b]\n"), "issues").toBe(true);
});
