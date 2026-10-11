import { test, expect } from "vitest";
import { acceptanceLines, acceptanceScript, judgeInstruction } from "../../src/language/template.js";
import { PROFILES } from "../../src/language/profiles.js";
import type { JudgeInputs, LanguageProfile } from "../../src/language/types.js";
import { fixture } from "../helpers.js";

const TS = PROFILES[0] as LanguageProfile;
const PY = PROFILES[1] as LanguageProfile;

test("Acceptance Lines example 1: single code target, no test target", () => {
  expect(acceptanceLines(TS, ["src/cli/parse.ts"])).toStrictEqual([
    "node_modules/.bin/tsc --noEmit",
    "node_modules/.bin/eslint src/cli/parse.ts",
    "node_modules/.bin/vitest run --reporter=dot",
  ]);
});

test("Acceptance Lines example 2: code and test targets, lint over both, own test run", () => {
  expect(acceptanceLines(TS, ["src/a.ts", "tests/a.test.ts"])).toStrictEqual([
    "node_modules/.bin/tsc --noEmit",
    "node_modules/.bin/eslint src/a.ts tests/a.test.ts",
    "node_modules/.bin/vitest run tests/a.test.ts --reporter=dot",
    "node_modules/.bin/vitest run --reporter=dot",
  ]);
});

test("Acceptance Lines example 3: python, parse takes files, markdown dropped", () => {
  expect(acceptanceLines(PY, ["pkg/a.py", "tests/test_a.py", "README.md"])).toStrictEqual([
    "python3 -m py_compile pkg/a.py tests/test_a.py",
    "ruff check pkg/a.py tests/test_a.py",
    "python3 -m pytest tests/test_a.py -q --tb=short",
    "python3 -m pytest -q --tb=short",
  ]);
});

test("Acceptance Lines example 4: no own target, only full run", () => {
  expect(acceptanceLines(TS, ["docs/x.md"])).toStrictEqual([
    "node_modules/.bin/vitest run --reporter=dot",
  ]);
});

test("Acceptance Script example 1: typescript, whole fixture text", () => {
  const script = acceptanceScript(TS, "parse-command", ["src/cli/parse.ts", "tests/cli/parse.test.ts"]);
  expect(script).toBe(fixture("language/scriptTs.txt"));
});

test("Acceptance Script example 2: python, Makefile has no extension", () => {
  const script = acceptanceScript(PY, "a", ["pkg/a.py", "Makefile"]);
  expect(script).toBe(fixture("language/scriptPy.txt"));
  expect(script.includes("cp Makefile $D/1-$S 2>/dev/null\n")).toBe(true);
});

test("Judge Instruction example 1: typescript, all placeholders filled", () => {
  const inputs: JudgeInputs = {
    test: "tests/cli/parse.examples.test.ts",
    module: "src/cli/parse.ts",
    docs: ["docs/TASK_P7_cli.md", "docs/CONVENTIONS.md"],
  };
  const text = judgeInstruction(TS, inputs);
  expect(
    text.startsWith(
      "Write ONLY the test file `tests/cli/parse.examples.test.ts`: one test per example of `src/cli/parse.ts` taken from docs/TASK_P7_cli.md, docs/CONVENTIONS.md, this instruction, in example order",
    ),
  ).toBe(true);
  expect(text.includes("{")).toBe(false);
});

test("Judge Instruction example 2: python, empty docs, module named twice", () => {
  const inputs: JudgeInputs = {
    test: "tests/test_a_examples.py",
    module: "pkg/a.py",
    docs: [],
  };
  const text = judgeInstruction(PY, inputs);
  expect(
    text.startsWith(
      "Write ONLY the test file `tests/test_a_examples.py`: one test per example of `pkg/a.py` taken from this instruction, in example order",
    ),
  ).toBe(true);
  expect(text.includes("Do not write or modify `pkg/a.py`")).toBe(true);
});

test("acceptanceLines: empty targets gives only the full run line", () => {
  expect(acceptanceLines(PY, [])).toStrictEqual(["python3 -m pytest -q --tb=short"]);
});

test("acceptanceLines: targets are used as given, backslashes kept", () => {
  const lines = acceptanceLines(PY, ["pkg\\a.py"]);
  expect(lines[0]).toBe("python3 -m py_compile pkg\\a.py");
});

test("acceptanceLines: a second test target does not add a second own-test line", () => {
  const lines = acceptanceLines(TS, ["tests/a.test.ts", "tests/b.spec.ts"]);
  expect(lines[2]).toBe("node_modules/.bin/vitest run tests/a.test.ts --reporter=dot");
  expect(lines).toHaveLength(4);
});

test("acceptanceScript: ends with exactly one newline", () => {
  const script = acceptanceScript(TS, "x", []);
  expect(script.endsWith("exit $rc\n")).toBe(true);
  expect(script.endsWith("exit $rc\n\n")).toBe(false);
});

test("acceptanceScript: header line holds the customId", () => {
  const script = acceptanceScript(PY, "my-id", []);
  expect(script.startsWith("D=/tmp/morph/my-id; mkdir -p $D; S=$(date +%s)-$$; L=$D/acc-$S.log\n")).toBe(true);
});

test("acceptanceScript: extension case of the target as given is kept", () => {
  const script = acceptanceScript(TS, "c", ["src/A.TS"]);
  expect(script.includes("cp src/A.TS $D/0-$S.TS 2>/dev/null\n")).toBe(true);
});

test("judgeInstruction: no placeholder survives, module appears twice", () => {
  const inputs: JudgeInputs = { test: "tests/t.ts", module: "src/m.ts", docs: ["docs/A.md"] };
  const text = judgeInstruction(TS, inputs);
  expect(text.includes("{")).toBe(false);
  expect(text.split("src/m.ts").length - 1).toBe(2);
});

test("judgeInstruction: docs joined with the instruction appended last", () => {
  const inputs: JudgeInputs = { test: "tests/t.ts", module: "src/m.ts", docs: ["docs/A.md", "docs/B.md"] };
  const text = judgeInstruction(PY, inputs);
  expect(text.includes("taken from docs/A.md, docs/B.md, this instruction")).toBe(true);
});
