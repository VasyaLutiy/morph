import { expect, test } from "vitest";
import { renderPrimer } from "../../src/primer/renderPrimer.js";
import type { PrimerDigest } from "../../src/primer/renderPrimer.js";
import { fixture, fixtureJson } from "../helpers.js";

const DIGESTS = fixtureJson("primer/render.json") as Record<string, PrimerDigest>;
const PRIMER1 = fixture("primer/primer1.md");
const PRIMER2 = fixture("primer/primer2.md");

test("Render Primer example 1: digest 1 at cap 16000 is exactly primer1.md", () => {
  const md = renderPrimer(DIGESTS["digest 1"], 16000);
  expect(md).toBe(PRIMER1);
  expect(md.length).toBe(11033);
  expect(md).toContain(
    "- 641 tests in 84 test files by the typescript profile (counted from text, not a run)",
  );
  expect(md).toContain("- cost: $0.2651 over 4 priced runs (0 unpriced)");
  expect(md).toContain(
    "← switch: builder V2 cut + V2 run → V2/ds; model z-ai/glm-5.3 → deepseek/deepseek-v4.1-flash",
  );
});

test("Render Primer example 2: digest 2 at cap 16000 is exactly primer2.md", () => {
  const md = renderPrimer(DIGESTS["digest 2"], 16000);
  expect(md).toBe(PRIMER2);
  expect(md).toContain(
    "missing: docs/MEASURE.md, docs/PLAN.md, docs/AUTONOMY.md, docs/DECISIONS.md",
  );
  expect(md).toContain("- archived runs: 0");
  expect(md).toContain("- skipped: x (no report.json)");
  expect(md).toContain("- no rows");
  expect(md).toContain("- next phase: none open (docs/PLAN.md)");
  expect(md).toContain("- none");
  expect(md).toContain("- not read: no .morph/issues.json");
});

test("Render Primer example 3: cap 600 cuts, cap 5952 keeps primer1.md whole", () => {
  const digest = DIGESTS["digest 1"];
  const head = PRIMER1.slice(0, 540);
  const expected = head.slice(0, head.lastIndexOf("\n") + 1) + "_… truncated to fit 600 chars_\n";
  const cut = renderPrimer(digest, 600);
  expect(cut).toBe(expected);
  expect(cut.length).toBe(511);
  expect(renderPrimer(digest, PRIMER1.length)).toBe(PRIMER1);
});

test("Render Primer example 4: issues read, issues unreadable, next and decisions set", () => {
  const digest = DIGESTS["digest 2"];

  const read = renderPrimer(
    { ...digest, story: { ...digest.story, issues: { state: "read", items: [] } } },
    16000,
  );
  const readLines = read.trimEnd().split("\n");
  expect(readLines[readLines.length - 1]).toBe("- none open");

  const unreadable = renderPrimer(
    { ...digest, story: { ...digest.story, issues: { state: "unreadable", items: [] } } },
    16000,
  );
  expect(unreadable).toContain("- not read: .morph/issues.json is not a JSON array");

  const set = renderPrimer(
    {
      ...digest,
      story: {
        ...digest.story,
        next: { phase: "P7", row: "P7 · cli · x", handoff: ["H", "Next: P8"] },
        decisions: ["a · b"],
      },
    },
    16000,
  );
  expect(set).toContain("- next phase (docs/PLAN.md): P7 · cli · x");
  expect(set).toContain("- handoff (docs/AUTONOMY.md):");
  expect(set).toContain("  > H");
  expect(set).toContain("  > Next: P8");
  expect(set).toContain("- a · b");
});
