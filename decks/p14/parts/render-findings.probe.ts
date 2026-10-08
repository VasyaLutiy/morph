// P14a probe for render-findings by docs/TASK_P14_reviewer.md §2.2 (Render Findings) — the review document: findings
// ordered by KIND_ORDER (an unknown kind last, stable) and numbered F1…, the counts with byKind, the verdict, and the
// markdown page (changed files, obligations, guardrails, mutants, findings with EXPECTED/GOT and the source tag).
// Record Render Findings examples 1-3, then the §2.2 rows. The full input and page are tests/fixtures/reviewer/review.*.
import { test, expect } from "vitest";
import { KIND_ORDER, orderFindings, renderFindings } from "../../src/reviewer/renderFindings.js";
import type { Finding, RenderInput, Review } from "../../src/reviewer/renderFindings.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

const EMPTY_MD = "# Review v1..HEAD\n\nClean: no findings.\n\n## Changed files (0)\n\n| file | status | lines | written by | scope |\n" +
  "|---|---|---|---|---|\n\n## Obligations (0 Functions, 0 examples, 0 missing)\n\n## Guardrails\n\n| guardrail | files | findings |\n" +
  "|---|---|---|\n\n## Findings\n\nNone.\n";
const ZERO = { obligation: 0, envelope: 0, scope: 0, guardrail: 0, mutation: 0 };
const OTHER: Finding = { kind: "other", source: "s", path: null, expected: "e", got: "g" };
const MUT: Finding = { kind: "mutation", source: "m", path: "x", expected: "e2", got: "g2" };

test("Render Findings example 1: an empty review is clean", () => {
  const want: Review = { range: "v1..HEAD", verdict: "clean", counts: { files: 0, obligations: 0, examples: 0, missing: 0,
    mutants: null, killed: null, findings: 0, byKind: ZERO }, findings: [], markdown: EMPTY_MD };
  expect(renderFindings({ base: "v1", head: "HEAD", changed: [], obligations: [], guardrails: [], mutants: null, findings: [] }))
    .toStrictEqual(want);
});

test("Render Findings example 2: review.input.json renders to review.md, findings by kind F1…F5", () => {
  const input = fixtureJson("reviewer/review.input.json") as RenderInput;
  const got = renderFindings(input);
  expect(got.markdown).toBe(fixture("reviewer/review.md"));
  expect(got.range).toBe("4f2a9c1..morph/20261009-101500");
  expect(got.verdict).toBe("findings");
  expect(got.counts).toStrictEqual({ files: 2, obligations: 1, examples: 3, missing: 1, mutants: 2, killed: 1, findings: 5,
    byKind: { obligation: 1, envelope: 1, scope: 1, guardrail: 1, mutation: 1 } });
  expect(got.findings.map((f) => [f.id, f.kind])).toStrictEqual([["F1", "obligation"], ["F2", "envelope"], ["F3", "scope"],
    ["F4", "guardrail"], ["F5", "mutation"]]);
  expect(got.findings[0]).toStrictEqual({ id: "F1", ...input.findings[2] });
});

test("Render Findings example 3: an unknown kind sorts last and is counted after the five", () => {
  expect(orderFindings([OTHER, MUT])).toStrictEqual([{ id: "F1", ...MUT }, { id: "F2", ...OTHER }]);
  const got = renderFindings({ base: "a", head: "b", changed: [], obligations: [], guardrails: [], mutants: [], findings: [OTHER] });
  expect(got.counts).toStrictEqual({ files: 0, obligations: 0, examples: 0, missing: 0, mutants: 0, killed: 0, findings: 1,
    byKind: { ...ZERO, other: 1 } });
  expect(Object.keys(got.counts.byKind)).toStrictEqual(["obligation", "envelope", "scope", "guardrail", "mutation", "other"]);
  expect(got.markdown).toBe("# Review a..b\n\n1 findings: obligation 0, envelope 0, scope 0, guardrail 0, mutation 0, other 1.\n\n" +
    "## Changed files (0)\n\n| file | status | lines | written by | scope |\n|---|---|---|---|---|\n\n" +
    "## Obligations (0 Functions, 0 examples, 0 missing)\n\n## Guardrails\n\n| guardrail | files | findings |\n|---|---|---|\n\n" +
    "## Mutants (0 of 0 killed)\n\n## Findings\n\n### F1 · other · s\n\n- path: —\n- EXPECTED: e\n- GOT: g\n");
});

test("§2.2 rows: KIND_ORDER; stable within a kind; a cell's | escaped, the heading not; an obligation with nothing missing", () => {
  expect([...KIND_ORDER]).toStrictEqual(["obligation", "envelope", "scope", "guardrail", "mutation"]);
  const f = (kind: string, source: string): Finding => ({ kind, source, path: null, expected: "x", got: "y" });
  expect(orderFindings([f("scope", "s1"), f("obligation", "o1"), f("scope", "s2"), f("zz", "z"), f("obligation", "o2"), f("aa", "a")])
    .map((n) => n.id + " " + n.source)).toStrictEqual(["F1 o1", "F2 o2", "F3 s1", "F4 s2", "F5 z", "F6 a"]);
  const got = renderFindings({ base: "b|1", head: "h", obligations: [
    { component: "c|d", function: "F", touchedBy: [], examples: 2, missing: [] }],
  changed: [{ path: "p", status: "deleted", added: 0, deleted: 4, writers: ["w1", "w2"], scope: null }],
  guardrails: [{ name: "G|H", files: 7, findings: 0 }], mutants: [{ path: "m|n.ts", line: 3, rule: "|| → &&", killed: true }],
  findings: [] });
  expect(got.range).toBe("b|1..h");
  expect(got.counts.examples).toBe(2);
  const md = got.markdown.split("\n");
  expect(md[0]).toBe("# Review b|1..h");
  expect(md).toContain("| p | deleted | +0 -4 | w1, w2 | — |");
  expect(md).toContain("## Obligations (1 Functions, 2 examples, 0 missing)");
  expect(md).toContain("| c\\|d · F | — | 2 | — |");
  expect(md).toContain("| G\\|H | 7 | 0 |");
  expect(md).toContain("## Mutants (1 of 1 killed)");
  expect(md).toContain("| m\\|n.ts:3 | \\|\\| → && | killed |");
  expect(got.markdown.endsWith("## Findings\n\nNone.\n")).toBe(true);
});
