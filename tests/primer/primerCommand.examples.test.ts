import path from "node:path";
import { expect, test } from "vitest";
import { countTests, primerCommand } from "../../src/primer/primerCommand.js";
import type { PrimerDeps } from "../../src/primer/primerCommand.js";
import { TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture, fixtureJson, tmpRepo, tmpRoot } from "../helpers.js";

const ENV = { PATH: process.env.PATH ?? "" };
const deps = (now: number): PrimerDeps => ({ env: ENV, now: () => now });

const STORY: Record<string, string> = {
  "docs/MEASURE.md": "story/measure.md",
  "docs/PLAN.md": "story/plan.md",
  "docs/AUTONOMY.md": "story/autonomy.md",
  "docs/DECISIONS.md": "story/decisions.md",
  ".morph/issues.json": "story/issues.json",
};

const RUNS = [
  "20261006-135524-8c114477",
  "20261007-092723-3c3f1c83",
  "20261007-111944",
  "20261007-155108",
  "20261007-204822",
];

const A_TEXT = "test(\"a\", () => {});\ntest (\"b\", () => {});\n";
const B_TEXT =
  "it(\"c\", () => {});\nit.skip(\"d\", () => {});\ntest.todo(\"e\");\nexpect(/x/.test(\"x\")).toBe(true);\n";
const C_TEXT = "export const test = (s: string): string => s;\ntest(\"not a test file\");\n";

const named = (text: string, root: string): string => text.split("{name}").join(path.basename(root));

test("Primer Command example 1", () => {
  const t = tmpRepo();
  try {
    t.write("tests/a.test.ts", A_TEXT);
    t.write("tests/b.spec.ts", B_TEXT);
    t.write("src/c.ts", C_TEXT);
    const result = primerCommand(t.root, false, deps(1791400000000));
    expect(result.code).toBe(0);
    expect(result.document.tests).toStrictEqual({ language: "typescript", files: 2, tests: 3 });
    expect(result.document.files).toBe(3);
    expect(result.document.generatedAt).toBe("2026-10-07T19:06:40.000Z");
    expect(result.document.written).toBe(null);
    const tests = countTests(TYPESCRIPT, [
      { path: "tests/a.test.ts", text: A_TEXT },
      { path: "tests/b.spec.ts", text: B_TEXT },
      { path: "src/c.ts", text: C_TEXT },
    ]);
    expect(tests).toStrictEqual({ language: "typescript", files: 2, tests: 3 });
  } finally {
    t.rm();
  }
});

test("Primer Command example 2", () => {
  const t = tmpRepo();
  try {
    t.write("pkg/a.py", "");
    t.write("pkg/b.py", "");
    t.write("tests/test_a.py", "def test_x():\n pass\n\nasync def test_y():\n pass\n\ndef helper():\n pass\n");
    t.write("pkg/b_test.py", "class T:\n def test_m(self):\n pass\n");
    t.write("web/x.ts", "test(\"ts\");\n");
    const result = primerCommand(t.root, false, deps(1791400000000));
    expect(result.code).toBe(0);
    expect(result.document.tests).toStrictEqual({ language: "python", files: 2, tests: 3 });
    expect(result.document.files).toBe(5);
  } finally {
    t.rm();
  }
});

test("Primer Command example 3", () => {
  const t = tmpRepo();
  try {
    for (const [key, name] of Object.entries(STORY)) {
      t.write(key, fixture("primer/" + name));
    }
    for (const dir of RUNS) {
      t.write(".morph/runs/" + dir + "/report.json", fixture("primer/runs/" + dir + "/report.json"));
    }
    t.write(".morph/runs/20261007-204822/answers/a.v1.answer.txt", "A");
    t.write(".morph/runs/20261007-204822/answers/lines.txt", "L");
    t.write(".morph/runs/broken/deck.json", "[]");
    t.write("tests/a.test.ts", A_TEXT);
    t.write("tests/b.spec.ts", B_TEXT);
    t.write("src/c.ts", C_TEXT);
    const result = primerCommand(t.root, true, deps(1791400000000));
    expect(result.code).toBe(0);
    const { root, markdown, ...without } = result.document;
    const expected = (fixtureJson("primer/command.json") as Record<string, unknown>)["Primer Command 3"];
    expect(without).toStrictEqual(expected);
    expect(root).toBe(t.root);
    const expectedMarkdown = named(fixture("primer/primer3.md"), t.root);
    expect(markdown).toBe(expectedMarkdown);
    expect(t.read(".morph/primer.md")).toBe(expectedMarkdown);
  } finally {
    t.rm();
  }
});

test("Primer Command example 4", () => {
  const t = tmpRepo();
  const notRepo = tmpRoot();
  try {
    t.write("tests/a.test.ts", A_TEXT);
    t.write("tests/b.spec.ts", B_TEXT);
    t.write("src/c.ts", C_TEXT);
    const result = primerCommand(t.root, false, deps(1791400000000));
    expect(result.code).toBe(0);
    expect(result.document.written).toBe(null);
    expect(t.exists(".morph/primer.md")).toBe(false);
    let thrown: unknown = null;
    try {
      primerCommand(notRepo.root, false, deps(1791400000000));
    } catch (e: unknown) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message.startsWith("git ls-files failed (exit 128): ")).toBe(true);
  } finally {
    t.rm();
    notRepo.rm();
  }
});

test("Primer Command example 5", () => {
  const t = tmpRepo();
  try {
    const result = primerCommand(t.root, false, deps(0));
    expect(result.code).toBe(0);
    expect(result.document.files).toBe(0);
    expect(result.document.tests).toStrictEqual({ language: "typescript", files: 0, tests: 0 });
    expect(result.document.runs.runs).toBe(0);
    expect(result.document.skipped).toBe(0);
    expect(result.document.chronology).toBe(0);
    expect(result.document.next).toBe(null);
    expect(result.document.missing).toStrictEqual(["measure", "plan", "autonomy", "decisions"]);
    expect(result.document.issues).toBe("absent");
    expect(result.document.generatedAt).toBe("1970-01-01T00:00:00.000Z");
    const expectedMarkdown = named(fixture("primer/primer5.md"), t.root);
    expect(result.document.markdown).toBe(expectedMarkdown);
  } finally {
    t.rm();
  }
});
