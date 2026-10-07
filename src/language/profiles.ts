import type { LanguageProfile, ProfileResult } from "./types.js";

export const TYPESCRIPT: LanguageProfile = {
  id: "typescript",
  extensions: [".ts", ".tsx"],
  testDirs: ["tests", "test", "__tests__"],
  testFilePattern: "^.*\\.(test|spec)\\.tsx?$",
  nameCase: "camel",
  codeTarget: "src/{component}/{name}.ts",
  testTarget: "tests/{component}/{name}.test.ts",
  judgeTarget: "tests/{component}/{name}.examples.test.ts",
  parseLine: "node_modules/.bin/tsc --noEmit",
  parseTakesFiles: false,
  lintLine: "node_modules/.bin/eslint {files}",
  ownTestLine: "node_modules/.bin/vitest run {test} --reporter=dot",
  fullRunLine: "node_modules/.bin/vitest run --reporter=dot",
  finale: "TypeScript with `strict` on, ESM with NodeNext resolution: every relative import carries the `.js` extension and types are imported with `import type`. No `any`: use `unknown` and narrow. Tests are vitest: `toBe` on scalars and short strings, `toStrictEqual` on a whole result; stubs come from `tests/helpers.ts`, never your own.",
  judgeInstruction: "Write ONLY the test file `{test}`: one test per example of `{module}` taken from {docs}, in example order, each named \"<Function> example <n>: <what>\". Do not write or modify `{module}`: the author of the criterion is not the author of the code. vitest, stubs imported from `tests/helpers.ts`; TypeScript with `strict` on, ESM, no `any`.",
  helpersModule: "tests/helpers.ts",
};

export const PYTHON: LanguageProfile = {
  id: "python",
  extensions: [".py", ".pyi"],
  testDirs: ["tests"],
  testFilePattern: "^(test_.*\\.py|.*_test\\.py)$",
  nameCase: "snake",
  codeTarget: "{component}/{name}.py",
  testTarget: "tests/test_{name}.py",
  judgeTarget: "tests/test_{name}_examples.py",
  parseLine: "python3 -m py_compile",
  parseTakesFiles: true,
  lintLine: "ruff check {files}",
  ownTestLine: "python3 -m pytest {test} -q --tb=short",
  fullRunLine: "python3 -m pytest -q --tb=short",
  finale: "Python 3.10 or later, standard library only, type hints on every public function. Tests are pytest: plain `assert` on scalars and short values; fixtures and stubs come from `tests/conftest.py`, never your own.",
  judgeInstruction: "Write ONLY the test file `{test}`: one test per example of `{module}` taken from {docs}, in example order, each test function named `test_<function>_example_<n>`. Do not write or modify `{module}`: the author of the criterion is not the author of the code. pytest, fixtures from `tests/conftest.py`; Python 3.10 or later, standard library only.",
  helpersModule: "tests/conftest.py",
};

export const PROFILES: readonly LanguageProfile[] = [TYPESCRIPT, PYTHON];

export const DEFAULT_LANGUAGE = "typescript";

export function resolveProfile(componentLanguage: string | null, mapLanguage: string | null): ProfileResult {
  const choice =
    componentLanguage !== null && componentLanguage !== ""
      ? componentLanguage
      : mapLanguage !== null && mapLanguage !== ""
        ? mapLanguage
        : DEFAULT_LANGUAGE;
  const key = choice.trim().toLowerCase();
  const known = PROFILES.map((p) => p.id).join(", ");
  for (const profile of PROFILES) {
    if (profile.id === key) {
      return { ok: true, profile };
    }
  }
  return { ok: false, error: "unknown language '" + choice + "' (known: " + known + ")" };
}

export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(
    /\{([A-Za-z]+)\}/g,
    (m: string, k: string): string => (Object.hasOwn(values, k) ? values[k] : m),
  );
}
