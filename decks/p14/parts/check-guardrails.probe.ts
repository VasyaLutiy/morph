// P14a probe for check-guardrails by docs/TASK_P14_reviewer.md §2.2 (Check Guardrails) — the test titles and the skipped or
// focused tests of a text by the file's language profile, and the reviewer's two guardrails over the test files of a range:
// Tests Kept (no distinct base title missing at head) and No New Skips (no more skips at head than at base).
// Record Check Guardrails examples 1-3, then the §2.2 rows.
import { test, expect } from "vitest";
import { GUARDRAILS, checkGuardrails, skipCount, testTitles } from "../../src/reviewer/checkGuardrails.js";
import type { GuardrailResult, TestText } from "../../src/reviewer/checkGuardrails.js";

const TS = 'import { test, it } from "vitest";\ntest("A: one", () => {});\nit(\'B\', () => {});\ntest(`C ${1}`, () => {});\n' +
  'foo.test("no");\nmytest("no2");\ntest.skip("D", () => {});\ndescribe.only("E", () => {});\n  test( "F" , () => {});\n';
const PY = "import pytest\n\ndef test_a():\n    pass\n\n    async def test_b(x):\n        pass\ndef helper():\n    pass\n" +
  'def testing_c():\n    pass\n@pytest.mark.skip\ndef test_d(): pass\n@pytest.mark.skipif(True, reason="x")\n@unittest.skip("y")\n' +
  "@pytest.mark.xfail\n";
const kept = (path: string, title: string, got: string) => ({ kind: "guardrail", source: "guardrail Tests Kept", path,
  expected: `the test "${title}" kept`, got });
const skips = (path: string, was: number, now: number) => ({ kind: "guardrail", source: "guardrail No New Skips", path,
  expected: `at most ${was} skipped or focused tests, as at base`, got: `${now} at head` });

test("Check Guardrails example 1: titles and skips by profile; an unknown profile reads nothing", () => {
  expect(testTitles(TS, "typescript")).toStrictEqual(["A: one", "B", "C ${1}", "F"]);
  expect(testTitles(PY, "python")).toStrictEqual(["test_a", "test_b", "testing_c", "test_d"]);
  expect(skipCount(TS, "typescript")).toBe(2);
  expect(skipCount(PY, "python")).toBe(4);
  expect(skipCount(TS, "go")).toBe(0);
  expect(testTitles(TS, "go")).toStrictEqual([]);
});

test("Check Guardrails example 2: a lost title, a deleted test file, two new skips; README.md has no profile", () => {
  const base: TestText[] = [
    { path: "tests/a.test.ts", text: 'test("A", () => {});\ntest("B", () => {});\ntest("B", () => {});\n' },
    { path: "tests/gone.test.ts", text: 'it("G", () => {});\n' },
    { path: "README.md", text: 'test("R")\n' },
    { path: "tests/test_x.py", text: "def test_one():\n    pass\n" },
  ];
  const head: TestText[] = [
    { path: "tests/a.test.ts", text: 'test("A", () => {});\ntest("C", () => {});\n' },
    { path: "tests/test_x.py", text: "@pytest.mark.skip\ndef test_one():\n    pass\n" },
    { path: "tests/new.test.ts", text: 'it.only("N", () => {});\ntest.skip("M", () => {});\n' },
  ];
  const want: GuardrailResult = {
    rows: [{ name: "Tests Kept", files: 3, findings: 2 }, { name: "No New Skips", files: 3, findings: 2 }],
    findings: [
      kept("tests/a.test.ts", "B", "no test of that name at head"),
      kept("tests/gone.test.ts", "G", "the test file is gone at head"),
      skips("tests/test_x.py", 0, 1),
      skips("tests/new.test.ts", 0, 2),
    ],
  };
  expect(checkGuardrails({ base, head })).toStrictEqual(want);
});

test("Check Guardrails example 3: nothing to check; equal skips at base and head", () => {
  expect(checkGuardrails({ base: [], head: [] })).toStrictEqual({
    rows: [{ name: "Tests Kept", files: 0, findings: 0 }, { name: "No New Skips", files: 0, findings: 0 }], findings: [] });
  const same: TestText[] = [
    { path: "tests/s.test.ts", text: 'test.skip("s", () => {});\n' },
    { path: "tests/test_s.py", text: "@pytest.mark.xfail\ndef test_s(): pass\n" },
    { path: "tests/u.spec.ts", text: 'it.todo("u");\n' },
  ];
  expect(checkGuardrails({ base: same, head: same })).toStrictEqual({
    rows: [{ name: "Tests Kept", files: 3, findings: 0 }, { name: "No New Skips", files: 3, findings: 0 }], findings: [] });
});

test("§2.2 rows: GUARDRAILS; fewer skips is fine; a renamed title is lost; titles are not counted with their multiplicity", () => {
  expect([...GUARDRAILS]).toStrictEqual(["Tests Kept", "No New Skips"]);
  const base: TestText[] = [{ path: "t/x.test.ts", text: 'it.skip("k", f);\nit.skip("l", f);\ntest("old name", f);\ntest("x", f);\ntest("x", f);\n' }];
  const head: TestText[] = [{ path: "t/x.test.ts", text: 'it.skip("k", f);\ntest("new name", f);\ntest("x", f);\n' },
    { path: "t/y.py", text: "@unittest.skip\ndef test_y(): pass\n" }];
  expect(checkGuardrails({ base, head })).toStrictEqual({
    rows: [{ name: "Tests Kept", files: 1, findings: 1 }, { name: "No New Skips", files: 2, findings: 1 }],
    findings: [kept("t/x.test.ts", "old name", "no test of that name at head"), skips("t/y.py", 0, 1)] });
  expect(testTitles('xit("a");\n$test("b");\nit(\n"c")\ntest("d")', "typescript")).toStrictEqual(["c", "d"]);
  expect(skipCount("x.describe.skip(1); describe.todo(2); it.skip (3)", "typescript")).toBe(1);
});

test("§2.2 rows: a profile id that is not python reads no python; a head file without a profile is not counted", () => {
  expect(testTitles("def test_x():\n    pass\n", "go")).toStrictEqual([]);
  expect(skipCount("@pytest.mark.skip\n", "go")).toBe(0);
  expect(checkGuardrails({ base: [], head: [{ path: "README.md", text: "it.only(1)" }, { path: "t/a.test.ts", text: "" }] }).rows)
    .toStrictEqual([{ name: "Tests Kept", files: 0, findings: 0 }, { name: "No New Skips", files: 1, findings: 0 }]);
});
