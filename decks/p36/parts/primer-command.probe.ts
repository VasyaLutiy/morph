// P36 probe for primer-command (src/primer/primerCommand.ts), from the P12/P16 probes: Primer Command example 1
// (unchanged, green on the stub), examples 3 and 5 whose primer.md now ends with the "Record vs code" section
// (no contour.yaml in the tmp repo: one line), and the document's chars 6164.
import path from "node:path";
import { expect, test } from "vitest";
import { primerCommand } from "../../src/primer/primerCommand.js";
import type { PrimerDeps } from "../../src/primer/primerCommand.js";
import { fixture, fixtureJson, tmpRepo } from "../../tests/helpers.js";

const deps = (now: number): PrimerDeps => ({ env: { PATH: process.env.PATH ?? "" }, now: () => now });
const named = (text: string, root: string): string => text.split("{name}").join(path.basename(root));
const A_TEXT = "test(\"a\", () => {});\ntest (\"b\", () => {});\n";
const B_TEXT =
  "it(\"c\", () => {});\nit.skip(\"d\", () => {});\ntest.todo(\"e\");\nexpect(/x/.test(\"x\")).toBe(true);\n";
const C_TEXT = "export const test = (s: string): string => s;\ntest(\"not a test file\");\n";
const STORY: Record<string, string> = {
  "docs/MEASURE.md": "story/measure.md",
  "docs/PLAN.md": "story/plan.md",
  "docs/AUTONOMY.md": "story/autonomy.md",
  "docs/DECISIONS.md": "story/decisions.md",
  ".morph/issues.json": "story/issues.json",
};
const RUNS = ["20261006-135524-8c114477", "20261007-092723-3c3f1c83", "20261007-111944", "20261007-155108", "20261007-204822"];
const RECORD_LINE = "\n## Record vs code\n\n- record: not read: no contour.yaml\n";

test("Primer Command example 1: counts unchanged", () => {
  const t = tmpRepo();
  try {
    t.write("tests/a.test.ts", A_TEXT);
    t.write("tests/b.spec.ts", B_TEXT);
    t.write("src/c.ts", C_TEXT);
    const r = primerCommand(t.root, false, deps(1791400000000));
    expect(r.code).toBe(0);
    expect(r.document.tests).toStrictEqual({ language: "typescript", files: 2, tests: 3 });
    expect(r.document.files).toBe(3);
    expect(r.document.written).toBe(null);
  } finally {
    t.rm();
  }
});

test("Primer Command example 3: primer3.md ends with the record line; chars 6164", () => {
  const t = tmpRepo();
  try {
    for (const [key, name] of Object.entries(STORY)) t.write(key, fixture("primer/" + name));
    for (const dir of RUNS) t.write(".morph/runs/" + dir + "/report.json", fixture("primer/runs/" + dir + "/report.json"));
    t.write(".morph/runs/20261007-204822/answers/a.v1.answer.txt", "A");
    t.write(".morph/runs/20261007-204822/answers/lines.txt", "L");
    t.write(".morph/runs/broken/deck.json", "[]");
    t.write("tests/a.test.ts", A_TEXT);
    t.write("tests/b.spec.ts", B_TEXT);
    t.write("src/c.ts", C_TEXT);
    const r = primerCommand(t.root, true, deps(1791400000000));
    const { root, markdown, ...without } = r.document;
    expect(root).toBe(t.root);
    expect(without).toStrictEqual((fixtureJson("primer/command.json") as Record<string, unknown>)["Primer Command 3"]);
    expect(without.chars).toBe(6164);
    expect(markdown.endsWith(RECORD_LINE)).toBe(true);
    expect(markdown).toBe(named(fixture("primer/primer3.md"), t.root));
    expect(t.read(".morph/primer.md")).toBe(markdown);
  } finally {
    t.rm();
  }
});

test("Primer Command example 5: an empty repository's primer5.md ends with the record line", () => {
  const t = tmpRepo();
  try {
    const r = primerCommand(t.root, false, deps(0));
    expect(r.code).toBe(0);
    expect(r.document.markdown.endsWith(RECORD_LINE)).toBe(true);
    expect(r.document.markdown).toBe(named(fixture("primer/primer5.md"), t.root));
  } finally {
    t.rm();
  }
});
