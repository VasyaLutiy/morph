import { expect, test } from "vitest";

import { primerCommand, runningLine } from "../../src/primer/primerCommand.js";
import type { PrimerDeps } from "../../src/primer/primerCommand.js";
import { tmpRepo } from "../helpers.js";
import type { TmpRepo } from "../helpers.js";

const ENV = { PATH: process.env.PATH ?? "" };

const commit = (r: TmpRepo, subject: string, trailers: string, files: Record<string, string>): string => {
  for (const [k, v] of Object.entries(files)) r.write(k, v);
  if (Object.keys(files).length > 0) r.git(["add", "-A", "--", ...Object.keys(files)]);
  r.git(["commit", "-q", "--allow-empty", "-m", subject, ...(trailers === "" ? [] : ["-m", trailers])]);
  return r.git(["rev-parse", "HEAD"]);
};

const MEASURE = [
  "# M",
  "",
  "Running total of the stretch: $1.5000 of $9 (A $1 + B $0.5).",
  "",
  "| фаза | строитель | карт план/принято | $ исп. | прогоны |",
  "|---|---|---|---|---|",
  "| P1 | night | 1 / 1 | 0.5 | |",
  "| P1 debt (agent) | claude -p | 1 / 1 | 2.25 | |",
  "",
].join("\n");

test("Primer Command example 6: the ownership section and the running total of a two-commit log", () => {
  const t = tmpRepo();
  try {
    commit(t, "q", "Morph-Card: q\nMorph-Model: m/q", {
      "src/q.ts": "export const q = 1;\n",
      "src/r.ts": "export const r = 2;\n",
    });
    commit(t, "run", "Morph-Run: 20261110-101010", {});
    commit(t, "q-judge", "Morph-Card: q-judge\nMorph-Model: m/r", {
      "tests/q.test.ts": 'test("q", () => {});\n',
    });
    t.write("docs/MEASURE.md", MEASURE);

    const deps: PrimerDeps = { env: ENV, now: () => 1791400000000 };
    const result = primerCommand(t.root, false, deps);

    expect(result.code).toBe(0);
    expect(result.document.ownership).toStrictEqual({ commits: 2, paths: 3 });
    expect(result.document.running).toBe("Running total of the stretch: $1.5000 of $9");

    const markdown = result.document.markdown;
    expect(markdown).toContain(
      "- debt rows (docs/MEASURE.md), not in these totals: P1 debt (agent) $2.25",
    );
    expect(markdown).toContain(
      '- running total (docs/MEASURE.md): "Running total of the stretch: $1.5000 of $9" vs $0.0000 archived here, difference 1.5000 — the two differ by runs made outside this repository (in MEASURE, no archive here) and archived runs MEASURE\'s total leaves out; debt rows are in neither',
    );
    expect(markdown).toContain("- git carries 2 Morph commits: m/r 1, m/q 1");
    expect(markdown).toContain("- tests/q.test.ts ← q-judge (m/r, run —)");
    expect(markdown).toContain("- src/q.ts ← q (m/q, run 20261110-101010)");
    expect(markdown).toContain("- src/r.ts ← q (m/q, run 20261110-101010)");

    expect(runningLine(null)).toBe(null);
    expect(runningLine("x\n Running total: $1 (a (b)\n")).toBe("Running total: $1");
    expect(runningLine("Running total " + "y".repeat(250))).toBe(
      "Running total " + "y".repeat(185) + "…",
    );
  } finally {
    t.rm();
  }
});
