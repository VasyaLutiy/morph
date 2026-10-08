// P16 probe for primer-command by docs/TASK_P16_primer-go.md §2.2 (src/primer/primerCommand.ts) — the go test count
// follows go test ./... (no "_"/"." segment, no testdata or vendor directory, one *testing.T parameter), and no profile
// counts a file under the top-level decks/. Record Primer Command examples 8 and 9, then the §2.2 rows.
import { test, expect } from "vitest";
import { countTests, isTestFile, primerCommand } from "../../src/primer/primerCommand.js";
import { GO, PYTHON, TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture, fixtureJson, tmpRepo } from "../../tests/helpers.js";

type Pair = [string, string];
const EX = fixtureJson("primer/examples.json") as Record<string, { files?: Pair[]; ts?: Pair[]; mini?: string[]; smoke?: string[] }>;
const deps = { env: { PATH: process.env.PATH ?? "" }, now: () => 1791400000000 };
const asFiles = (pairs: Pair[]): { path: string; text: string }[] => pairs.map(([path, text]) => ({ path, text }));

test("Primer Command example 8: go counts only what go test ./... runs, never decks/; ts probes are no tests", () => {
  const ex = EX["Primer Command 8"];
  const files = ex.files ?? [];
  const t = tmpRepo();
  try {
    for (const [p, text] of files) t.write(p, text);
    const r = primerCommand(t.root, false, deps);
    expect(r.code).toBe(0);
    expect(r.document.files).toBe(11);
    expect(r.document.tests).toStrictEqual({ language: "go", files: 2, tests: 5 });
    expect(countTests(GO, asFiles(files))).toStrictEqual({ language: "go", files: 2, tests: 5 });
    expect(countTests(TYPESCRIPT, asFiles(ex.ts ?? []))).toStrictEqual({ language: "typescript", files: 1, tests: 1 });
  } finally {
    t.rm();
  }
});

test("Primer Command example 9: the go-mini smoke tree counts 3 files / 12 tests, not 6 / 27", () => {
  const ex = EX["Primer Command 9"];
  const pairs: Pair[] = [
    ...(ex.mini ?? []).map((p): Pair => [p, fixture("go-mini/" + p)]),
    ...(ex.smoke ?? []).map((p): Pair => [p, fixture("primer/go-smoke/" + p)]),
  ];
  expect(pairs.length).toBe(13);
  const t = tmpRepo();
  try {
    for (const [p, text] of pairs) t.write(p, text);
    const r = primerCommand(t.root, false, deps);
    expect(r.code).toBe(0);
    expect(r.document.files).toBe(13);
    expect(r.document.tests).toStrictEqual({ language: "go", files: 3, tests: 12 });
    expect(countTests(GO, asFiles(pairs))).toStrictEqual({ language: "go", files: 3, tests: 12 });
  } finally {
    t.rm();
  }
});

test("rows: the path rules on their edges, per profile", () => {
  const go = (p: string): boolean => isTestFile(GO, p);
  expect([go("a_test.go"), go("./calc/a_test.go"), go("calc\\a_test.go"), go("src/decks/a_test.go"),
    go("x/testdata_ok/a_test.go"), go("x/my_vendor/v_test.go"), go("x/a_b/c_test.go"), go("vendor_test.go"),
    go("testdata_test.go"), go("x.y/a_test.go")]).toStrictEqual([true, true, true, true, true, true, true, true, true, true]);
  expect([go("_a_test.go"), go(".a_test.go"), go("x/_y/a_test.go"), go("x/.y/a_test.go"), go("a/testdata/b/c_test.go"),
    go("q/vendor/a_test.go"), go("decks/a_test.go"), go("./decks/p1/x_test.go"), go("decks\\p1\\x_test.go")])
    .toStrictEqual([false, false, false, false, false, false, false, false, false]);
  const ts = (p: string): boolean => isTestFile(TYPESCRIPT, p);
  expect([ts("tests/a.test.ts"), ts(".hidden/a.test.ts"), ts("tests/_a.test.ts"), ts("x/testdata/a.test.ts"),
    ts("vendor/a.spec.ts"), ts("src/decks/a.test.ts"), ts("decks/p9/a.test.ts"), ts("decks/p9/parts/a.probe.ts")])
    .toStrictEqual([true, true, true, true, true, true, false, false]);
  expect([isTestFile(PYTHON, "tests/test_a.py"), isTestFile(PYTHON, "_x/test_a.py"), isTestFile(PYTHON, "decks/t/test_a.py")])
    .toStrictEqual([true, true, false]);
});

test("rows: the go call rule takes one *testing.T parameter, named or not", () => {
  const text = "func TestA(t *testing.T) {}\nfunc TestB(*testing.T) {}\nfunc TestC(_ *testing.T) {}\nfunc TestD (tt *testing.T) {}\n" +
    "func TestE( t  *testing.T ) {}\nfunc TestMain(m *testing.M) { m.Run() }\nfunc TestF(b *testing.B) {}\nfunc TestG(f *testing.F) {}\n" +
    "func TestH(t *testing.T, x int) {}\nfunc TestI() {}\nfunc Testable(t *testing.T) {}\n\tfunc TestJ(t *testing.T) {}\n";
  expect(countTests(GO, [{ path: "k/k_test.go", text }])).toStrictEqual({ language: "go", files: 1, tests: 5 });
  expect(countTests(TYPESCRIPT, [{ path: "tests/a.test.ts", text: "test(\"a\", () => {});\nit(\"b\", () => {});\n" }]))
    .toStrictEqual({ language: "typescript", files: 1, tests: 2 });
  expect(countTests(PYTHON, [{ path: "tests/test_a.py", text: "def test_a():\n    pass\nasync def test_b():\n    pass\n" }]))
    .toStrictEqual({ language: "python", files: 1, tests: 2 });
});
