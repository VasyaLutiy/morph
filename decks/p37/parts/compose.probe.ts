// P37 probe for compose (src/builder/compose.ts) — issue #49: the "== full" step runs the tests related to the
// card's targets (fullStep). Record Code Acceptance examples 1, 2, 6 and Judge Acceptance examples 1, 2; the
// fixtures code1/code2/judge1/judge2.txt hold the related line.
import { test, expect } from "vitest";
import { codeAcceptance, judgeAcceptance, fullStep, RELATED_LINE } from "../../src/builder/compose.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture } from "../../tests/helpers.js";
import type { CardContext } from "../../src/builder/types.js";

const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "a", phase: "p1", targets: ["src/x/a.ts"], siblings: ["src/x/b.ts"], frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false,
  profile: TYPESCRIPT, guard: "// guard\n", firstdiff: "// firstdiff\n", ...over,
});
const two = (): CardContext =>
  ctx({ phase: "p2", targets: ["src/x/a.ts", "tests/x/a.test.ts"], siblings: [], fullExclude: ["tests/x/old.test.ts"], ownGit: true });
const fullLine = (text: string): string => {
  const line = text.split("\n").filter((l) => l.startsWith("echo '== full'; "))[0];
  return line + "\n";
};

test("Code Acceptance example 1: tsc, eslint, guard, probe, the verdict, full, frozen, untracked", () => {
  expect(codeAcceptance(ctx({}), "// probe\n", null, null)).toBe(fixture("builder/code1.txt"));
});

test("Code Acceptance example 2: own git, a smoke test, an extra line, a full step with an exclude", () => {
  expect(codeAcceptance(two(), "// probe\n", 5, "echo '== bin'; true\n")).toBe(fixture("builder/code2.txt"));
});

test("Code Acceptance example 6: RELATED_LINE", () => {
  expect(RELATED_LINE).toBe("node_modules/.bin/vitest related --run {test} --reporter=dot");
});

test("Code Acceptance example 6: fullStep of the ctx of example 1 is code1.txt's full line", () => {
  const got = fullStep(ctx({}));
  expect(got).toBe(fullLine(fixture("builder/code1.txt")));
  expect(got).toContain("vitest related --run src/x/a.ts --passWithNoTests --reporter=dot");
});

test("Code Acceptance example 6: fullStep of the ctx of example 2 is code2.txt's full line", () => {
  const got = fullStep(two());
  expect(got).toBe(fullLine(fixture("builder/code2.txt")));
  expect(got).toContain("vitest related --run src/x/a.ts tests/x/a.test.ts --passWithNoTests --exclude tests/x/old.test.ts --reporter=dot");
});

test("Judge Acceptance example 1: one new file, the lits file, the guard line with 2 10", () => {
  const j = ctx({ id: "a-judge", targets: ["tests/x/a.examples.test.ts"] });
  const files = [{ file: "tests/x/a.examples.test.ts", min: 2, max: 10, lits: ["x \"y\"", "z"], drop: [], new: true }];
  expect(judgeAcceptance(j, files)).toBe(fixture("builder/judge1.txt"));
});

test("Judge Acceptance example 2: two files, a names step for the old one, own runs both", () => {
  const j = ctx({ id: "ab-judge", phase: "p3", targets: ["tests/x/a.examples.test.ts", "tests/x/b.examples.test.ts"], siblings: [],
    fullExclude: ["tests/x/b.examples.test.ts"], ownGit: true });
  const files = [
    { file: "tests/x/a.examples.test.ts", min: 3, max: 11, lits: ["a"], drop: [], new: true },
    { file: "tests/x/b.examples.test.ts", min: 4, max: 4, lits: [], drop: ["B example 2: old"], new: false },
  ];
  expect(judgeAcceptance(j, files)).toBe(fixture("builder/judge2.txt"));
});
