// P15 probe for primer-command by docs/TASK_P15_golang.md §2.2 (src/primer/primerCommand.ts) — go test functions
// counted by go test's rule when the go profile claims the most files. Record Primer Command example 7, then the
// §2.2 rows.
import { test, expect } from "vitest";
import { countTests, pickProfile, primerCommand } from "../../src/primer/primerCommand.js";
import { GO, PYTHON, TYPESCRIPT } from "../../src/language/profiles.js";
import { tmpRepo, tmpRoot } from "../../tests/helpers.js";

const A = "package calc\n\nimport \"testing\"\n\nfunc TestA(t *testing.T) {}\nfunc TestB_2(t *testing.T) {}\nfunc Testable(t *testing.T) {}\nfunc helper() {}\n// func TestC(t *testing.T) {}\n";
const R = "package report\n\nimport \"testing\"\n\nfunc Test(t *testing.T) {}\n\tfunc TestIndented(t *testing.T) {}\nfunc Test9(t *testing.T) {}\n";

test("Primer Command example 7: go tests counted by the go profile", () => {
  const t = tmpRepo();
  try {
    t.write("go.mod", "module mini\n\ngo 1.22\n");
    t.write("calc/a.go", "package calc\n");
    t.write("calc/a_test.go", A);
    t.write("report/r_test.go", R);
    t.write("web/x.ts", "test(\"ts\");\n");
    const r = primerCommand(t.root, false, { env: { PATH: process.env.PATH ?? "" }, now: () => 1791400000000 });
    expect(r.code).toBe(0);
    expect(r.document.tests).toStrictEqual({ language: "go", files: 2, tests: 4 });
    expect(r.document.files).toBe(5);
    expect(countTests(GO, [{ path: "calc/a_test.go", text: A }, { path: "calc/a.go", text: "func TestZ(t *testing.T) {}\n" }]))
      .toStrictEqual({ language: "go", files: 1, tests: 2 });
  } finally {
    t.rm();
  }
});

test("rows: the go rule on its edges; typescript and python unchanged; the go profile picked by count", () => {
  const edge = "func Test_x(t *testing.T) {}\nfunc Testing(t *testing.T) {}\nfunc TestMain(m *testing.M) {}\n" +
    "func TestX (t *testing.T) {}\n  func TestY(t *testing.T) {}\n/* func TestZ(t *testing.T) {} */\nvar TestW = 1\n";
  expect(countTests(GO, [{ path: "x/e_test.go", text: edge }])).toStrictEqual({ language: "go", files: 1, tests: 3 });
  expect(countTests(GO, [{ path: "tests/e.go", text: edge }, { path: "e_test.ts", text: edge }])).toStrictEqual({ language: "go", files: 0, tests: 0 });
  expect(countTests(TYPESCRIPT, [{ path: "tests/a.test.ts", text: "test(\"a\", () => {});\nit(\"b\", () => {});\nfunc TestQ(t *T) {}\n" }]))
    .toStrictEqual({ language: "typescript", files: 1, tests: 2 });
  expect(countTests(PYTHON, [{ path: "tests/test_a.py", text: "def test_a():\n    pass\nfunc TestQ(t *T) {}\n" }]))
    .toStrictEqual({ language: "python", files: 1, tests: 1 });
  expect(pickProfile(["a.go", "b.go", "c.ts"]).id).toBe("go");
  expect(pickProfile(["a.go", "c.ts"]).id).toBe("typescript");
  const e = tmpRoot();
  try {
    expect(() => primerCommand(e.root, false, { env: { PATH: process.env.PATH ?? "" }, now: () => 0 })).toThrow(/^git ls-files failed \(exit 128\): /);
  } finally {
    e.rm();
  }
});
