// P8 probe for paths: normalizePath, hasExtension, isTest, codeTargets, testTarget, profileForPath by
// docs/TASK_P8_language.md §2.2, one test per record example (Component language, Classify Path 1-4,
// Detect Profile 1-2), then the §2.2 rows and the types.
import { test, expect, expectTypeOf } from "vitest";
import { normalizePath, hasExtension, isTest, codeTargets, testTarget, profileForPath } from "../../src/language/paths.js";
import { PROFILES } from "../../src/language/profiles.js";
import type { LanguageProfile } from "../../src/language/types.js";

const TS = PROFILES[0] as LanguageProfile;
const PY = PROFILES[1] as LanguageProfile;
const idOf = (p: LanguageProfile | null): string => (p === null ? "null" : p.id);

test("Classify Path example 1: typescript tests", () => {
  const paths = ["tests/cli/parse.examples.test.ts", "src/cli/parse.ts", "src/__tests__/x.ts", "src/a.spec.tsx", "src/tests.ts"];
  expect(paths.map((p) => isTest(TS, p)).join(",")).toBe("true,false,true,true,false");
});

test("Classify Path example 2: python tests, the backslash path normalised", () => {
  const paths = ["tests/conftest.py", "pkg/test_a.py", "pkg/a_test.py", "pkg/testing.py", "tests\\a.py"];
  expect(paths.map((p) => isTest(PY, p)).join(",")).toBe("true,true,true,false,true");
});

test("Classify Path example 3: codeTargets as given in order, then testTarget", () => {
  const targets = ["src/a.ts", "tests/a.test.ts", "README.md", "src/b.TSX", "./src/c.ts"];
  expect(codeTargets(TS, targets)).toStrictEqual(["src/a.ts", "src/b.TSX", "./src/c.ts"]);
  expect(testTarget(TS, targets)).toBe("tests/a.test.ts");
});

test("Classify Path example 4: no python test; one code target", () => {
  expect(testTarget(PY, ["a/b.py", "docs/x.md"])).toBe(null);
  expect(codeTargets(PY, ["a/b.py", "docs/x.md"])).toStrictEqual(["a/b.py"]);
});

test("Detect Profile example 1: by extension, case-insensitive", () => {
  expect(["src/a.ts", "x/y.PYI", "web/App.tsx"].map((p) => idOf(profileForPath(p))).join(",")).toBe("typescript,python,typescript");
});

test("Detect Profile example 2: no extension claimed is null", () => {
  expect(["README.md", "Makefile", ".ts"].map((p) => idOf(profileForPath(p))).join(",")).toBe("null,null,null");
});

test("§2.2: normalizePath", () => {
  expect(normalizePath("././tests\\a\\b.ts")).toBe("tests/a/b.ts");
  expect(normalizePath(".\\src\\a.ts")).toBe("src/a.ts");
  expect(normalizePath("src/./a.ts")).toBe("src/./a.ts");
  expect(normalizePath("../a.ts")).toBe("../a.ts");
});

test("§2.2: hasExtension on the normalised path, lower-cased", () => {
  expect(hasExtension(PY, "PKG/A.PY")).toBe(true);
  expect(hasExtension(TS, "src/.ts")).toBe(false);
  expect(hasExtension(TS, "src/a.d.ts")).toBe(true);
  expect(hasExtension(TS, "src/a.ts.md")).toBe(false);
  expect(hasExtension(TS, "tests.ts\\x")).toBe(false);
});

test("§2.2: isTest — directory parts only, the profile's own dirs, the pattern on the base name", () => {
  expect(isTest(TS, "test/x.ts")).toBe(true);
  expect(isTest(PY, "test/x.py")).toBe(false);
  expect(isTest(TS, "./tests/x.ts")).toBe(true);
  expect(isTest(TS, "src/x.test.ts")).toBe(true);
  expect(isTest(TS, "src/x.test.js")).toBe(false);
  expect(isTest(PY, "tests")).toBe(false);
  expect(isTest(PY, "pkg/test_.py")).toBe(true);
});

test("§2.2: testTarget is the first test; tests and foreign files are not code", () => {
  const t = ["src/a.ts", "tests/b.test.ts", "tests/c.test.ts", "tests/helpers.ts", "x.py"];
  expect(testTarget(TS, t)).toBe("tests/b.test.ts");
  expect(codeTargets(TS, t)).toStrictEqual(["src/a.ts"]);
  expect(codeTargets(PY, t)).toStrictEqual(["x.py"]);
  expect(codeTargets(TS, [])).toStrictEqual([]);
  expect(testTarget(TS, [".\\tests\\d.test.ts"])).toBe(".\\tests\\d.test.ts");
});

test("§2.2: the types", () => {
  expectTypeOf(normalizePath).toEqualTypeOf<(path: string) => string>();
  expectTypeOf(hasExtension).toEqualTypeOf<(profile: LanguageProfile, path: string) => boolean>();
  expectTypeOf(isTest).toEqualTypeOf<(profile: LanguageProfile, path: string) => boolean>();
  expectTypeOf(codeTargets).toEqualTypeOf<(profile: LanguageProfile, targets: readonly string[]) => string[]>();
  expectTypeOf(testTarget).toEqualTypeOf<(profile: LanguageProfile, targets: readonly string[]) => string | null>();
  expectTypeOf(profileForPath).toEqualTypeOf<(path: string) => LanguageProfile | null>();
});
