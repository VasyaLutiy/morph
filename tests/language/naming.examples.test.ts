import { expect, test } from "vitest";
import { caseName, cutTargets, nameWords, slugName } from "../../src/language/naming.js";
import { PROFILES } from "../../src/language/profiles.js";
import type { LanguageProfile } from "../../src/language/types.js";

const TS = PROFILES[0] as LanguageProfile;
const PY = PROFILES[1] as LanguageProfile;

test("Name Targets example 1: typescript, camel case targets", () => {
  const got = cutTargets(TS, "cli", "Parse Command");
  expect(got).toStrictEqual({
    ok: true,
    slug: "parse-command",
    targets: {
      code: "src/cli/parseCommand.ts",
      test: "tests/cli/parseCommand.test.ts",
      judge: "tests/cli/parseCommand.examples.test.ts",
    },
  });
});

test("Name Targets example 2: python, snake case targets", () => {
  const got = cutTargets(PY, "Run Loop", "Process Generation");
  expect(got).toStrictEqual({
    ok: true,
    slug: "process-generation",
    targets: {
      code: "run_loop/process_generation.py",
      test: "tests/test_process_generation.py",
      judge: "tests/test_process_generation_examples.py",
    },
  });
});

test("Name Targets example 3: typescript, digits and parenthesis in the name", () => {
  const got = cutTargets(TS, "planner", "Build HTTP Request (v2)");
  expect(got).toStrictEqual({
    ok: true,
    slug: "build-http-request-v2",
    targets: {
      code: "src/planner/buildHttpRequestV2.ts",
      test: "tests/planner/buildHttpRequestV2.test.ts",
      judge: "tests/planner/buildHttpRequestV2.examples.test.ts",
    },
  });
});

test("Name Targets example 4: wordless names are errors, first component then function", () => {
  const first = cutTargets(TS, "cli", "--");
  expect(first).toStrictEqual({ ok: false, error: "no letters or digits in name '--'" });
  const second = cutTargets(TS, " ", "Parse Command");
  expect(second).toStrictEqual({ ok: false, error: "no letters or digits in name ' '" });
});

test("nameWords lowercases and splits on non-alphanumerics", () => {
  expect(nameWords("  Build  HTTP--Request ")).toStrictEqual(["build", "http", "request"]);
});

test("slugName joins words with a dash", () => {
  expect(slugName("Build HTTP Request (v2)")).toBe("build-http-request-v2");
  expect(slugName("!!!")).toBe("");
});

test("caseName camel upper-cases every word but the first", () => {
  expect(caseName("2nd pass x", "camel")).toBe("2ndPassX");
  expect(caseName("ALLCAPS", "camel")).toBe("allcaps");
});

test("caseName snake joins with underscores, empty name stays empty", () => {
  expect(caseName("Process Generation", "snake")).toBe("process_generation");
  expect(caseName("--", "camel")).toBe("");
});

test("cutTargets checks the component before the function", () => {
  const got = cutTargets(TS, "--", "also --");
  expect(got).toStrictEqual({ ok: false, error: "no letters or digits in name '--'" });
});

test("cutTargets narrows ok before reading fields", () => {
  const got = cutTargets(PY, "contour", "Fill Template");
  expect(got.ok ? got.targets.code : got.error).toBe("contour/fill_template.py");
});

test("cutTargets snake component and slug for python", () => {
  const got = cutTargets(PY, "Response Layer", "Write");
  expect(got.ok ? got.slug : got.error).toBe("write");
  expect(got.ok ? got.targets.judge : got.error).toBe("tests/test_write_examples.py");
});
