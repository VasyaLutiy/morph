// P8 probe for template: acceptanceLines, acceptanceScript, judgeInstruction by docs/TASK_P8_language.md
// §2.2, one test per record example (Component language, Acceptance Lines 1-4, Acceptance Script 1-2,
// Judge Instruction 1-2), then the §2.2 rows and the types.
import { test, expect, expectTypeOf } from "vitest";
import { acceptanceLines, acceptanceScript, judgeInstruction } from "../../src/language/template.js";
import { PROFILES } from "../../src/language/profiles.js";
import type { JudgeInputs, LanguageProfile } from "../../src/language/types.js";
import { fixture } from "../../tests/helpers.js";

const TS = PROFILES[0] as LanguageProfile;
const PY = PROFILES[1] as LanguageProfile;
const FULL_TS = "node_modules/.bin/vitest run --reporter=dot";

test("Acceptance Lines example 1: one code target", () => {
  expect(acceptanceLines(TS, ["src/cli/parse.ts"])).toStrictEqual([
    "node_modules/.bin/tsc --noEmit", "node_modules/.bin/eslint src/cli/parse.ts", FULL_TS]);
});

test("Acceptance Lines example 2: code and its own test", () => {
  expect(acceptanceLines(TS, ["src/a.ts", "tests/a.test.ts"])).toStrictEqual([
    "node_modules/.bin/tsc --noEmit", "node_modules/.bin/eslint src/a.ts tests/a.test.ts",
    "node_modules/.bin/vitest run tests/a.test.ts --reporter=dot", FULL_TS]);
});

test("Acceptance Lines example 3: python names its files on the parse line", () => {
  expect(acceptanceLines(PY, ["pkg/a.py", "tests/test_a.py", "README.md"])).toStrictEqual([
    "python3 -m py_compile pkg/a.py tests/test_a.py", "ruff check pkg/a.py tests/test_a.py",
    "python3 -m pytest tests/test_a.py -q --tb=short", "python3 -m pytest -q --tb=short"]);
});

test("Acceptance Lines example 4: no own target, only the full run", () => {
  expect(acceptanceLines(TS, ["docs/x.md"])).toStrictEqual([FULL_TS]);
});

test("Acceptance Script example 1: the typescript script", () => {
  expect(acceptanceScript(TS, "parse-command", ["src/cli/parse.ts", "tests/cli/parse.test.ts"])).toBe(fixture("language/scriptTs.txt"));
});

test("Acceptance Script example 2: the python script, a target without an extension", () => {
  const got = acceptanceScript(PY, "a", ["pkg/a.py", "Makefile"]);
  expect(got).toBe(fixture("language/scriptPy.txt"));
  expect(got.split("\n")[2]).toBe("cp Makefile $D/1-$S 2>/dev/null");
});

test("Judge Instruction example 1: typescript, the docs then this instruction", () => {
  const got = judgeInstruction(TS, { test: "tests/cli/parse.examples.test.ts", module: "src/cli/parse.ts",
    docs: ["docs/TASK_P7_cli.md", "docs/CONVENTIONS.md"] });
  expect(got.startsWith("Write ONLY the test file `tests/cli/parse.examples.test.ts`: one test per example of `src/cli/parse.ts` " +
    "taken from docs/TASK_P7_cli.md, docs/CONVENTIONS.md, this instruction, in example order")).toBe(true);
  expect(got.includes("{")).toBe(false);
});

test("Judge Instruction example 2: python with no docs", () => {
  const got = judgeInstruction(PY, { test: "tests/test_a_examples.py", module: "pkg/a.py", docs: [] });
  expect(got.startsWith("Write ONLY the test file `tests/test_a_examples.py`: one test per example of `pkg/a.py` " +
    "taken from this instruction, in example order")).toBe(true);
  expect(got.includes("Do not write or modify `pkg/a.py`")).toBe(true);
});

test("§2.2: lines — order kept, tests count as own, the first test only", () => {
  expect(acceptanceLines(TS, ["tests/b.test.ts", "src/b.ts", "tests/c.test.ts"])).toStrictEqual([
    "node_modules/.bin/tsc --noEmit", "node_modules/.bin/eslint tests/b.test.ts src/b.ts tests/c.test.ts",
    "node_modules/.bin/vitest run tests/b.test.ts --reporter=dot", FULL_TS]);
  expect(acceptanceLines(PY, [])).toStrictEqual(["python3 -m pytest -q --tb=short"]);
  expect(acceptanceLines(PY, ["src/a.ts"])).toStrictEqual(["python3 -m pytest -q --tb=short"]);
});

test("§2.2: script — empty targets, ext case kept, every line ends with a newline", () => {
  expect(acceptanceScript(TS, "z", [])).toBe("D=/tmp/morph/z; mkdir -p $D; S=$(date +%s)-$$; L=$D/acc-$S.log\n(\n set -e\n " +
    FULL_TS + "\n) > $L 2>&1; rc=$?; cat $L; exit $rc\n");
  const s = acceptanceScript(TS, "u", ["src/A.TS", "docs/r.md"]);
  expect(s.split("\n").slice(1, 3).join("|")).toBe("cp src/A.TS $D/0-$S.TS 2>/dev/null|cp docs/r.md $D/1-$S.md 2>/dev/null");
  expect(s.endsWith("exit $rc\n")).toBe(true);
});

test("§2.2: judge instruction — every placeholder filled, the module twice", () => {
  const got = judgeInstruction(TS, { test: "t$&.ts", module: "m.ts", docs: ["d"] });
  expect(got.split("`m.ts`").length - 1).toBe(2);
  expect(got.includes("`t$&.ts`")).toBe(true);
  expect(got.includes("taken from d, this instruction,")).toBe(true);
});

test("§2.2: the types", () => {
  expectTypeOf(acceptanceLines).toEqualTypeOf<(profile: LanguageProfile, targets: readonly string[]) => string[]>();
  expectTypeOf(acceptanceScript).toEqualTypeOf<(profile: LanguageProfile, customId: string, targets: readonly string[]) => string>();
  expectTypeOf(judgeInstruction).toEqualTypeOf<(profile: LanguageProfile, inputs: JudgeInputs) => string>();
  expectTypeOf<JudgeInputs>().toEqualTypeOf<{ test: string; module: string; docs: string[] }>();
});
