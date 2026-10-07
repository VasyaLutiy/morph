// P8 probe for naming: nameWords, slugName, caseName, cutTargets by docs/TASK_P8_language.md §2.2, one
// test per record example (Component language, Name Targets 1-4), then the §2.2 rows and the types.
import { test, expect, expectTypeOf } from "vitest";
import { nameWords, slugName, caseName, cutTargets } from "../../src/language/naming.js";
import { PROFILES } from "../../src/language/profiles.js";
import type { LanguageProfile, NameCase, TargetsResult } from "../../src/language/types.js";

const TS = PROFILES[0] as LanguageProfile;
const PY = PROFILES[1] as LanguageProfile;

test("Name Targets example 1: typescript camelCase targets", () => {
  expect(cutTargets(TS, "cli", "Parse Command")).toStrictEqual({ ok: true, slug: "parse-command", targets: {
    code: "src/cli/parseCommand.ts", test: "tests/cli/parseCommand.test.ts", judge: "tests/cli/parseCommand.examples.test.ts" } });
});

test("Name Targets example 2: python snake_case targets", () => {
  expect(cutTargets(PY, "Run Loop", "Process Generation")).toStrictEqual({ ok: true, slug: "process-generation", targets: {
    code: "run_loop/process_generation.py", test: "tests/test_process_generation.py",
    judge: "tests/test_process_generation_examples.py" } });
});

test("Name Targets example 3: acronyms and punctuation are words", () => {
  expect(cutTargets(TS, "planner", "Build HTTP Request (v2)")).toStrictEqual({ ok: true, slug: "build-http-request-v2", targets: {
    code: "src/planner/buildHttpRequestV2.ts", test: "tests/planner/buildHttpRequestV2.test.ts",
    judge: "tests/planner/buildHttpRequestV2.examples.test.ts" } });
});

test("Name Targets example 4: a name without words", () => {
  expect(cutTargets(TS, "cli", "--")).toStrictEqual({ ok: false, error: "no letters or digits in name '--'" });
  expect(cutTargets(TS, " ", "Parse Command")).toStrictEqual({ ok: false, error: "no letters or digits in name ' '" });
});

test("§2.2: nameWords and slugName", () => {
  expect(nameWords("  Build  HTTP--Request ")).toStrictEqual(["build", "http", "request"]);
  expect(nameWords("a_b.c/D9")).toStrictEqual(["a", "b", "c", "d9"]);
  expect(nameWords("!!")).toStrictEqual([]);
  expect(slugName("Read Deck File")).toBe("read-deck-file");
  expect(slugName("x")).toBe("x");
});

test("§2.2: caseName camel and snake", () => {
  expect(caseName("Read Deck File", "camel")).toBe("readDeckFile");
  expect(caseName("Read Deck File", "snake")).toBe("read_deck_file");
  expect(caseName("2nd pass x", "camel")).toBe("2ndPassX");
  expect(caseName("ALLCAPS", "camel")).toBe("allcaps");
  expect(caseName("", "camel")).toBe("");
});

test("§2.2: the component is cased too; the component is checked first", () => {
  const r = cutTargets(TS, "Run Loop", "Run Deck");
  expect(r.ok ? r.targets.code + " " + r.targets.judge : r.error).toBe("src/runLoop/runDeck.ts tests/runLoop/runDeck.examples.test.ts");
  const e = cutTargets(PY, "!", "?");
  expect(e.ok ? "ok" : e.error).toBe("no letters or digits in name '!'");
  const f = cutTargets(PY, "", "x");
  expect(f.ok ? "ok" : f.error).toBe("no letters or digits in name ''");
  const k = Object.keys(cutTargets(TS, "a", "b"));
  expect(k.join(",")).toBe("ok,slug,targets");
});

test("§2.2: the types", () => {
  expectTypeOf(nameWords).toEqualTypeOf<(name: string) => string[]>();
  expectTypeOf(slugName).toEqualTypeOf<(name: string) => string>();
  expectTypeOf(caseName).toEqualTypeOf<(name: string, nameCase: NameCase) => string>();
  expectTypeOf(cutTargets).toEqualTypeOf<(profile: LanguageProfile, component: string, functionName: string) => TargetsResult>();
});
