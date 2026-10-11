import { expect, test } from "vitest";

import { NEIGHBOUR_RULES, TREE_PROFILES } from "../../src/language/treeProfiles.js";

test("Tree Profiles example 5: NEIGHBOUR_RULES is the three neighbour entries as the record writes them", () => {
  expect(NEIGHBOUR_RULES).toStrictEqual([
    {
      id: "typescript",
      file: "\\.[cm]?tsx?$",
      directory: false,
      testFile: null,
      module: "'\"?(\\.\\.?/[^'\"]+)\"?'",
    },
    {
      id: "python",
      file: "\\.pyi?$",
      directory: false,
      testFile: null,
      module: null,
    },
    {
      id: "go",
      file: "\\.go$",
      directory: true,
      testFile: "_test\\.go$",
      module: null,
    },
  ]);
});

test("Tree Profiles example 6: the file, testFile and module patterns of NEIGHBOUR_RULES", () => {
  const paths = [
    "src/b.ts",
    "src/cli/c.mts",
    "calc/b.go",
    "calc/b_test.go",
    "pkg/b.py",
    "README.md",
  ];

  const matched = (pattern: string): string[] =>
    paths.filter((path) => new RegExp(pattern).test(path));

  expect(matched(NEIGHBOUR_RULES[0].file)).toStrictEqual(["src/b.ts", "src/cli/c.mts"]);
  expect(matched(NEIGHBOUR_RULES[1].file)).toStrictEqual(["pkg/b.py"]);
  expect(matched(NEIGHBOUR_RULES[2].file)).toStrictEqual(["calc/b.go", "calc/b_test.go"]);
  expect(paths.filter((path) => NEIGHBOUR_RULES.some((rule) => new RegExp(rule.file).test(path)))).toStrictEqual([
    "src/b.ts",
    "src/cli/c.mts",
    "calc/b.go",
    "calc/b_test.go",
    "pkg/b.py",
  ]);

  const goTestFile = NEIGHBOUR_RULES[2].testFile;
  expect(typeof goTestFile).toBe("string");
  if (typeof goTestFile !== "string") {
    throw new Error("go's testFile is not a string");
  }
  expect(new RegExp(goTestFile).test("calc/b_test.go")).toBe(true);
  expect(new RegExp(goTestFile).test("calc/b.go")).toBe(false);

  const tsModule = NEIGHBOUR_RULES[0].module;
  expect(typeof tsModule).toBe("string");
  if (typeof tsModule !== "string") {
    throw new Error("typescript's module is not a string");
  }
  const groups = (line: string): string[] =>
    [...line.matchAll(new RegExp(tsModule, "g"))].map((m) => m[1]);

  expect(groups(`(1,10): error TS2305: Module '"./a.js"' has no exported member 'fmtOut'.`)).toStrictEqual([
    "./a.js",
  ]);
  expect(
    groups("(1,1): error TS2307: Cannot find module '../units/gone.js' or its corresponding type declarations."),
  ).toStrictEqual(["../units/gone.js"]);
  expect(groups("(3,4): error TS2304: Cannot find name 'q7'.")).toStrictEqual([]);
});

test("Tree Profiles: NEIGHBOUR_RULES ids are the PROFILES ids in the same order", () => {
  expect(NEIGHBOUR_RULES.map((rule) => rule.id)).toStrictEqual(TREE_PROFILES.map((profile) => profile.id));
});

test("Tree Profiles: every non-null NEIGHBOUR_RULES pattern compiles to a RegExp", () => {
  for (const rule of NEIGHBOUR_RULES) {
    expect(new RegExp(rule.file)).toBeInstanceOf(RegExp);
    if (rule.testFile !== null) {
      expect(new RegExp(rule.testFile)).toBeInstanceOf(RegExp);
    }
    if (rule.module !== null) {
      expect(new RegExp(rule.module, "g")).toBeInstanceOf(RegExp);
    }
  }
});
