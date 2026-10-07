// P10b probe for compose: litsJson, codeAcceptance, judgeAcceptance by docs/TASK_P10b_builder.md §2.2, one test per
// record example (Component builder: Code Acceptance 1-2, Judge Acceptance 1-3), then the §2.2 rows and the types.
// The expected scripts are build.py's own (tests/fixtures/builder/, written from its functions).
import { test, expect, expectTypeOf } from "vitest";
import { codeAcceptance, judgeAcceptance, litsJson } from "../../src/builder/compose.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import type { CardContext, JudgeFile } from "../../src/builder/types.js";
import { TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture } from "../../tests/helpers.js";

// the heredoc tags are spelled in two pieces: build.py refuses a probe whose text holds one
const M = (t: string): string => "MORPH" + "_" + t + "_EOF";

const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "a", phase: "p1", targets: ["src/x/a.ts"], siblings: [], frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false,
  profile: TYPESCRIPT, guard: "// guard\n", firstdiff: "// firstdiff\n", ...over,
});

test("Code Acceptance example 1: a code card, probe only", () => {
  expect(codeAcceptance(ctx({ siblings: ["src/x/b.ts"] }), "// probe\n", null, null)).toBe(fixture("builder/code1.txt"));
});

test("Code Acceptance example 2: smoke test, own git, an extra step, an exclude", () => {
  expect(codeAcceptance(ctx({ phase: "p2", targets: ["src/x/a.ts", "tests/x/a.test.ts"], fullExclude: ["tests/x/old.test.ts"], ownGit: true }),
    "// probe\n", 5, "echo '== bin'; true\n")).toBe(fixture("builder/code2.txt"));
});

test("Judge Acceptance example 1: one new file", () => {
  const files: JudgeFile[] = [{ file: "tests/x/a.examples.test.ts", min: 2, max: 10, lits: ['x "y"', "z"], drop: [], new: true }];
  expect(judgeAcceptance(ctx({ id: "a-judge", targets: ["tests/x/a.examples.test.ts"], siblings: ["src/x/b.ts"] }), files))
    .toBe(fixture("builder/judge1.txt"));
});

test("Judge Acceptance example 2: a new file and a patched one, own git", () => {
  const files: JudgeFile[] = [
    { file: "tests/x/a.examples.test.ts", min: 3, max: 11, lits: ["a"], drop: [], new: true },
    { file: "tests/x/b.examples.test.ts", min: 4, max: 4, lits: [], drop: ["B example 2: old"], new: false },
  ];
  expect(judgeAcceptance(ctx({ id: "ab-judge", phase: "p3", targets: files.map((f) => f.file),
    fullExclude: ["tests/x/b.examples.test.ts"], ownGit: true }), files)).toBe(fixture("builder/judge2.txt"));
});

test("Judge Acceptance example 3: litsJson keeps non-ASCII", () => {
  expect(litsJson(["a", "é"])).toBe('["a", "é"]');
  expect(litsJson([])).toBe("[]");
});

test("§2.2 the stage order of a code card", () => {
  const s = codeAcceptance(ctx({ targets: ["src/x/a.ts", "tests/x/a.test.ts"], ownGit: true }), "// probe\n", 3, "echo '== bin'\n");
  const at = (x: string): number => s.indexOf(x);
  const order = ["G0=$(", "echo '== tsc'", "echo '== eslint'", "echo '== guard'", "echo '== probe'", "echo '== own'",
    '[ "$E" = 0 ]', "echo '== bin'", "echo '== full'", "echo '== own git'", "echo '== frozen'", "X=$(git ls-files"];
  expect(order.map(at).every((x, i, a) => x >= 0 && (i === 0 || x > a[i - 1]))).toBe(true);
  expect(s).toContain("node $P/guard.mjs src src/x/a.ts; node $P/guard.mjs tests tests/x/a.test.ts 1 3\n");
  expect(s.endsWith(") > $L 2>&1; rc=$?; cat $L; exit $rc")).toBe(true);
});

test("§2.2 a judge: the guard lines per file, names only for a patched file, no probe heredoc", () => {
  const files: JudgeFile[] = [
    { file: "tests/p.examples.test.ts", min: 1, max: 2, lits: [], drop: [], new: false },
    { file: "tests/q.examples.test.ts", min: 0, max: 9, lits: ["q"], drop: [], new: true },
  ];
  const s = judgeAcceptance(ctx({ id: "pq-judge", targets: files.map((f) => f.file) }), files);
  expect(s).toContain("echo '== guard tests/q.examples.test.ts'; node $P/guard.mjs tests tests/q.examples.test.ts 0 9 $P/lits1.json\n");
  expect(s).toContain("echo '== names tests/p.examples.test.ts'");
  expect(s).not.toContain("echo '== names tests/q.examples.test.ts'");
  expect(s).not.toContain(M("PROBE"));
  expect(s).not.toContain("G0=$(");
  expect(s).toContain("echo '== own'; node_modules/.bin/vitest run tests/p.examples.test.ts tests/q.examples.test.ts --reporter=dot");
});

test("§2.2 types", () => {
  expectTypeOf(litsJson).toEqualTypeOf<(lits: readonly string[]) => string>();
  expectTypeOf(codeAcceptance).toEqualTypeOf<(ctx: CardContext, probe: string, smoke: number | null, extra: string | null) => string>();
  expectTypeOf(judgeAcceptance).toEqualTypeOf<(ctx: CardContext, files: readonly JudgeFile[]) => string>();
});
