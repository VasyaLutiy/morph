import { normalizePath, hasExtension, isTest, codeTargets, testTarget, profileForPath } from "../../src/language/paths.js";
import { PROFILES } from "../../src/language/profiles.js";
import type { LanguageProfile } from "../../src/language/types.js";
import { expect, test } from "vitest";

const TS = PROFILES[0] as LanguageProfile;
const PY = PROFILES[1] as LanguageProfile;

test("Classify Path example 1: directory tests counts, base tests.ts does not", () => {
  const paths = ["tests/cli/parse.examples.test.ts", "src/cli/parse.ts", "src/__tests__/x.ts", "src/a.spec.tsx", "src/tests.ts"];
  const got = paths.map((p) => isTest(TS, p));
  expect(got).toStrictEqual([true, false, true, true, false]);
});

test("Classify Path example 2: backslash path is normalised", () => {
  const paths = ["tests/conftest.py", "pkg/test_a.py", "pkg/a_test.py", "pkg/testing.py", "tests\\a.py"];
  const got = paths.map((p) => isTest(PY, p));
  expect(got).toStrictEqual([true, true, true, false, true]);
});

test("Classify Path example 3: codeTargets as given, testTarget first", () => {
  const targets = ["src/a.ts", "tests/a.test.ts", "README.md", "src/b.TSX", "./src/c.ts"];
  expect(codeTargets(TS, targets)).toStrictEqual(["src/a.ts", "src/b.TSX", "./src/c.ts"]);
  expect(testTarget(TS, targets)).toBe("tests/a.test.ts");
});

test("Classify Path example 4: no test target for python", () => {
  const targets = ["a/b.py", "docs/x.md"];
  expect(testTarget(PY, targets)).toBe(null);
  expect(codeTargets(PY, targets)).toStrictEqual(["a/b.py"]);
});

test("Detect Profile example 1: extension decides, case-insensitive", () => {
  const paths = ["src/a.ts", "x/y.PYI", "web/App.tsx"];
  const got = paths.map((p) => {
    const profile = profileForPath(p);
    return profile === null ? "null" : profile.id;
  });
  expect(got).toStrictEqual(["typescript", "python", "typescript"]);
});

test("Detect Profile example 2: unknown or missing extension gives null", () => {
  const paths = ["README.md", "Makefile", ".ts"];
  const got = paths.map((p) => profileForPath(p));
  expect(got).toStrictEqual([null, null, null]);
});

test("normalizePath: backslashes and repeated leading ./ removed", () => {
  expect(normalizePath("././tests\\a\\b.ts")).toBe("tests/a/b.ts");
  expect(normalizePath("src/./a.ts")).toBe("src/./a.ts");
  expect(normalizePath("../a.ts")).toBe("../a.ts");
});

test("hasExtension: lowercase extension, dotfile has none", () => {
  expect(hasExtension(PY, "x/y.PYI")).toBe(true);
  expect(hasExtension(TS, "src/.ts")).toBe(false);
  expect(hasExtension(TS, "src/a.d.ts")).toBe(true);
  expect(hasExtension(PY, "Makefile")).toBe(false);
});

test("isTest: tests alone is not a python test, test dir is not a typescript dir", () => {
  expect(isTest(PY, "tests")).toBe(false);
  expect(isTest(PY, "test/x.py")).toBe(false);
  expect(isTest(TS, "test/x.ts")).toBe(true);
});

test("codeTargets and testTarget keep the given form, order kept", () => {
  const targets = ["tests\\a.py", "pkg/b.py", "pkg/c_test.py"];
  expect(codeTargets(PY, targets)).toStrictEqual(["pkg/b.py"]);
  expect(testTarget(PY, targets)).toBe("tests\\a.py");
});

test("profileForPath returns the registry object itself", () => {
  expect(profileForPath("pkg/a.py")).toBe(PROFILES[1]);
  expect(profileForPath("src/a.ts")).toBe(PROFILES[0]);
});

test("empty targets give no code and no test", () => {
  expect(codeTargets(TS, [])).toStrictEqual([]);
  expect(testTarget(TS, [])).toBe(null);
});
