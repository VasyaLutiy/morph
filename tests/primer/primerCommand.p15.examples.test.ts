import { test, expect } from "vitest";
import { countTests, primerCommand } from "../../src/primer/primerCommand.js";
import { GO } from "../../src/language/profiles.js";
import { tmpRepo } from "../helpers.js";

test("Primer Command example 7: the go rule counts TestA and TestB_2, leaves Testable out", () => {
  const t = tmpRepo();
  try {
    t.write("go.mod", "module mini\n\ngo 1.22\n");
    t.write("calc/a.go", "package calc\n");
    t.write(
      "calc/a_test.go",
      "package calc\n\nimport \"testing\"\n\nfunc TestA(t *testing.T) {}\nfunc TestB_2(t *testing.T) {}\nfunc Testable(t *testing.T) {}\nfunc helper() {}\n// func TestC(t *testing.T) {}\n",
    );
    t.write(
      "report/r_test.go",
      "package report\n\nimport \"testing\"\n\nfunc Test(t *testing.T) {}\n\tfunc TestIndented(t *testing.T) {}\nfunc Test9(t *testing.T) {}\n",
    );
    t.write("web/x.ts", "test(\"ts\");\n");

    const result = primerCommand(t.root, false, {
      env: { PATH: process.env.PATH ?? "" },
      now: () => 1791400000000,
    });

    expect(result.code).toBe(0);
    expect(result.document.tests).toStrictEqual({ language: "go", files: 2, tests: 4 });
    expect(result.document.files).toBe(5);

    const counted = countTests(GO, [
      { path: "calc/a_test.go", text: t.read("calc/a_test.go") },
      { path: "calc/a.go", text: "func TestZ(t *testing.T) {}\n" },
    ]);

    expect(counted).toStrictEqual({ language: "go", files: 1, tests: 2 });
  } finally {
    t.rm();
  }
});
