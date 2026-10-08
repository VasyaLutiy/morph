import { expect, test } from "vitest";
import { renderPrimer } from "../../src/primer/renderPrimer.js";
import type { DigestLine, PrimerDigest } from "../../src/primer/renderPrimer.js";
import { fixtureJson } from "../helpers.js";

const DIGESTS = fixtureJson("primer/render.json") as Record<string, PrimerDigest>;
const DIGEST1 = DIGESTS["digest 1"];
const DIGEST2 = DIGESTS["digest 2"];

const LINE: DigestLine = {
  phase: "",
  date: "",
  builder: "",
  models: [],
  written: null,
  planned: null,
  runs: 0,
  notes: "",
  cost: "",
  switches: [],
};

test("Render Primer example 5: debt rows, running total and ownership of one commit", () => {
  const one = renderPrimer(
    {
      ...DIGEST2,
      ownership: {
        commits: 1,
        models: [{ model: "", commits: 1 }],
        paths: [{ path: "a b.ts", writes: [{ card: "k", model: "", run: null }] }],
      },
      running: "Running total: 12 runs",
      story: {
        ...DIGEST2.story,
        chronology: [
          { ...LINE, phase: "P3 Debt (x)", cost: "" },
          { ...LINE, phase: "P4 debts", cost: "1.5" },
        ],
      },
    },
    16000,
  );
  const lines = one.split("\n");
  expect(lines).toContain(
    "- debt rows (docs/MEASURE.md), not in these totals: P3 Debt (x) $—",
  );
  expect(lines).toContain(
    '- running total (docs/MEASURE.md): "Running total: 12 runs" vs $0.0000 archived here — the two differ by runs made outside this repository (in MEASURE, no archive here) and archived runs MEASURE\'s total leaves out; debt rows are in neither',
  );
  expect(lines).toContain("- git carries 1 Morph commit: — 1");
  expect(lines).toContain(
    "- 1 path written by cards, most recent first; per path its cards, newest first:",
  );
  expect(lines).toContain("- a b.ts ← k (—, run —)");

  const priced = renderPrimer({ ...DIGEST1, running: "Running total: $0.2000" }, 16000);
  expect(priced).toContain("vs $0.2651 archived here, difference -0.0651 — ");
});
