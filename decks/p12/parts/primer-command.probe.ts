// P12a probe for primer-command by docs/TASK_P12_primer.md §2.2 (Primer Command) — the listing through git, the profile
// that claims most files, tests counted by the profile's rule in its test files only, the archives and docs read from
// the root, the markdown rendered and written on --write; a git failure thrown. Record Primer Command examples 1-5, then
// the §2.2 rows.
import { test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { countTests, isTestFile, pickProfile, primerCommand, PRIMER_CAP, PRIMER_FILE } from "../../src/primer/primerCommand.js";
import type { PrimerDeps, PrimerDocument } from "../../src/primer/primerCommand.js";
import { PYTHON, TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture, fixtureJson, tmpRepo, tmpRoot } from "../../tests/helpers.js";

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

test("Primer Command example 1: two test( and one it( give 3 by the typescript profile", () => {
  const t = tmpRepo();
  try {
    for (const [k, v] of Object.entries(TS_FILES)) t.write(k, v);
    const r = primerCommand(t.root, false, deps(1791400000000));
    expect(r.code, "code").toBe(0);
    expect(r.document.tests, "tests").toStrictEqual({ language: "typescript", files: 2, tests: 3 });
    expect(`${r.document.files}|${r.document.generatedAt}|${r.document.written}`, "files, clock, written").toBe("3|2026-10-07T19:06:40.000Z|null");
    expect(countTests(TYPESCRIPT, Object.entries(TS_FILES).map(([p, text]) => ({ path: p, text }))), "countTests").toStrictEqual(
      { language: "typescript", files: 2, tests: 3 });
  } finally {
    t.rm();
  }
});

test("Primer Command example 2: four python files outvote one typescript file", () => {
  const t = tmpRepo();
  try {
    t.write("pkg/a.py", "x = 1\n");
    t.write("pkg/b.py", "y = 2\n");
    t.write("tests/test_a.py", "def test_x():\n    pass\n\nasync def test_y():\n    pass\n\ndef helper():\n    pass\n");
    t.write("pkg/b_test.py", "class T:\n    def test_m(self):\n        pass\n");
    t.write("web/x.ts", 'test("ts");\n');
    const r = primerCommand(t.root, false, deps(1791400000000));
    expect(r.document.tests, "tests").toStrictEqual({ language: "python", files: 2, tests: 3 });
    expect(r.document.files, "files").toBe(5);
  } finally {
    t.rm();
  }
});

function storyRepo(): ReturnType<typeof tmpRepo> {
  const t = tmpRepo();
  for (const [k, v] of Object.entries(STORY)) t.write(k, fixture("primer/" + v));
  for (const d of RUNS) t.write(".morph/runs/" + d + "/report.json", fixture("primer/runs/" + d + "/report.json"));
  t.write(".morph/runs/20261007-204822/answers/a.v1.answer.txt", "A");
  t.write(".morph/runs/20261007-204822/answers/lines.txt", "L");
  t.write(".morph/runs/broken/deck.json", "[]");
  for (const [k, v] of Object.entries(TS_FILES)) t.write(k, v);
  return t;
}

test("Primer Command example 3: the story repo, written to .morph/primer.md", () => {
  const t = storyRepo();
  try {
    const r = primerCommand(t.root, true, deps(1791400000000));
    const { root, markdown, ...rest } = r.document;
    expect(r.code, "code").toBe(0);
    expect(root, "root").toBe(t.root);
    expect(rest, "command.json").toStrictEqual((fixtureJson("primer/command.json") as Record<string, unknown>)["Primer Command 3"]);
    expect(markdown, "primer3.md").toBe(named(fixture("primer/primer3.md"), t.root));
    expect(t.read(".morph/primer.md"), "written").toBe(markdown);
  } finally {
    t.rm();
  }
});

test("Primer Command example 4: nothing written without --write; not a repository throws", () => {
  const t = tmpRepo();
  const n = tmpRoot();
  try {
    for (const [k, v] of Object.entries(TS_FILES)) t.write(k, v);
    expect(primerCommand(t.root, false, deps(1791400000000)).document.written, "written").toBe(null);
    expect(t.exists(".morph/primer.md"), "no file").toBe(false);
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

test("Primer Command example 5: an empty repository", () => {
  const t = tmpRepo();
  try {
    const r = primerCommand(t.root, false, deps(0));
    const d: PrimerDocument = r.document;
    expect(`${r.code}|${d.files}|${d.runs.runs}|${d.skipped}|${d.chronology}|${d.next}|${d.issues}|${d.generatedAt}`, "counts").toBe(
      "0|0|0|0|0|null|absent|1970-01-01T00:00:00.000Z");
    expect(d.tests, "tests").toStrictEqual({ language: "typescript", files: 0, tests: 0 });
    expect(d.missing, "missing").toStrictEqual(["measure", "plan", "autonomy", "decisions"]);
    expect(d.markdown, "primer5.md").toBe(named(fixture("primer/primer5.md"), t.root));
    expect(d.chars, "chars").toBe(d.markdown.length);
  } finally {
    t.rm();
  }
});

test("§2.2 rows: test files by pattern only, the tie and the empty listing, the constants, the document's keys", () => {
  expect([isTestFile(TYPESCRIPT, "tests/helpers.ts"), isTestFile(TYPESCRIPT, "src\\x.spec.tsx"), isTestFile(TYPESCRIPT, "a.test.js"),
    isTestFile(PYTHON, "tests/conftest.py"), isTestFile(PYTHON, "a/x_test.py")].join(","), "isTestFile").toBe("false,true,false,false,true");
  expect(`${pickProfile([]).id}|${pickProfile(["a.py", "b.ts"]).id}|${pickProfile(["a.py", "README.md"]).id}`, "pickProfile").toBe("typescript|typescript|python");
  expect(countTests(PYTHON, [{ path: "test_q.py", text: "def test_a(): pass\n\tdef test_b(): pass\nx = 'def test_c'\n" },
    { path: "q.py", text: "def test_d(): pass\n" }]), "python rule").toStrictEqual({ language: "python", files: 1, tests: 2 });
  expect(countTests(TYPESCRIPT, [{ path: "x.test.ts", text: "it(a);$test(b);_it(c);it  (d);test\n(e);\n" }]), "typescript rule").toStrictEqual(
    { language: "typescript", files: 1, tests: 3 });
  expect(`${PRIMER_CAP}|${PRIMER_FILE}`, "constants").toBe("16000|.morph/primer.md");
  const t = tmpRepo();
  try {
    t.write("a.test.ts", "test(1);\n");
    t.git(["add", "a.test.ts"]);
    t.write(".gitignore", "ign/\n");
    t.write("ign/b.test.ts", "test(2);\n");
    fs.mkdirSync(t.path(".morph/runs/r1/answers"), { recursive: true });
    t.write(".morph/runs/r1/answers/x.answer.txt", "x");
    t.write(".morph/runs/r1/report.json", '{"runId": "r1", "outcomes": []}');
    t.write(".morph/runs/file.json", "{}");
    const r = primerCommand(t.root, true, deps(5));
    expect(Object.keys(r.document).join(","), "keys").toBe("root,generatedAt,files,tests,runs,skipped,chronology,next,missing,issues,chars,written,markdown");
    expect(`${r.document.files}|${r.document.tests.tests}|${r.document.runs.runs}|${r.document.runs.answers}|${r.document.skipped}|${r.document.written}`, "listing").toBe(
      "5|1|1|1|0|.morph/primer.md");
    expect(r.document.markdown.length <= PRIMER_CAP, "under the cap").toBe(true);
  } finally {
    t.rm();
  }
});
