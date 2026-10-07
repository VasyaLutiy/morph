import { test, expect } from "vitest";
import { fixture } from "../helpers.js";
import { litsJson, codeAcceptance, judgeAcceptance } from "../../src/builder/compose.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { TYPESCRIPT } from "../../src/language/profiles.js";
import type { CardContext, JudgeFile } from "../../src/builder/types.js";

const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "a", phase: "p1", targets: ["src/x/a.ts"], siblings: [], frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false,
  profile: TYPESCRIPT, guard: "// guard\n", firstdiff: "// firstdiff\n", ...over,
});

test("Code Acceptance example 1: the full stage chain without own git, smoke or extra", () => {
  const c = ctx({ siblings: ["src/x/b.ts"] });
  expect(codeAcceptance(c, "// probe\n", null, null)).toBe(fixture("builder/code1.txt"));
});

test("Code Acceptance example 2: own git, smoke test, extra step and a full exclude", () => {
  const c = ctx({
    id: "a", phase: "p2", targets: ["src/x/a.ts", "tests/x/a.test.ts"], siblings: [],
    fullExclude: ["tests/x/old.test.ts"], ownGit: true,
  });
  expect(codeAcceptance(c, "// probe\n", 5, "echo '== bin'; true\n")).toBe(fixture("builder/code2.txt"));
});

test("Judge Acceptance example 1: a single new judge file with its lits and no names step", () => {
  const c = ctx({ id: "a-judge", targets: ["tests/x/a.examples.test.ts"], siblings: ["src/x/b.ts"] });
  const files: JudgeFile[] = [
    { file: "tests/x/a.examples.test.ts", min: 2, max: 10, lits: ["x \"y\"", "z"], drop: [], new: true },
  ];
  expect(judgeAcceptance(c, files)).toBe(fixture("builder/judge1.txt"));
});

test("Judge Acceptance example 2: two files, a names step for the old one, own git", () => {
  const c = ctx({
    id: "ab-judge", phase: "p3", targets: ["tests/x/a.examples.test.ts", "tests/x/b.examples.test.ts"],
    fullExclude: ["tests/x/b.examples.test.ts"], ownGit: true,
  });
  const files: JudgeFile[] = [
    { file: "tests/x/a.examples.test.ts", min: 3, max: 11, lits: ["a"], drop: [], new: true },
    { file: "tests/x/b.examples.test.ts", min: 4, max: 4, lits: [], drop: ["B example 2: old"], new: false },
  ];
  expect(judgeAcceptance(c, files)).toBe(fixture("builder/judge2.txt"));
});

test("Judge Acceptance example 3: litsJson keeps non-ASCII and an empty list is []", () => {
  expect(litsJson(["a", "é"])).toBe("[\"a\", \"é\"]");
  expect(litsJson([])).toBe("[]");
});
