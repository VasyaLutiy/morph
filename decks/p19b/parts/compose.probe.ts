// P19b probe for compose by docs/TASK_P19b_deps.md §2.2 (src/builder/types.ts, src/builder/compose.ts) — a code card's
// guard line names the packages its Component declares (allowArg), a card without any keeps its acceptance byte for
// byte, a judge's acceptance reads neither allowed nor vendor (issue #10). Record Code Acceptance 1, 3, Judge
// Acceptance 4, then rows.
import { test, expect } from "vitest";
import { allowArg, codeAcceptance, judgeAcceptance } from "../../src/builder/compose.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { TYPESCRIPT } from "../../src/language/profiles.js";
import type { BuildInput, CardContext, JudgeFile } from "../../src/builder/types.js";
import { fixture } from "../../tests/helpers.js";

const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "a", phase: "p1", targets: ["src/x/a.ts"], siblings: ["src/x/b.ts"], frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false,
  profile: TYPESCRIPT, guard: "// guard\n", firstdiff: "// firstdiff\n", ...over,
});
const ctx2 = (over: Partial<CardContext>): CardContext => ctx({ id: "a", phase: "p2", targets: ["src/x/a.ts", "tests/x/a.test.ts"],
  siblings: [], fullExclude: ["tests/x/old.test.ts"], ownGit: true, ...over });
const G1 = "echo '== guard'; node $P/guard.mjs src src/x/a.ts\n";
const G2 = "guard.mjs src src/x/a.ts; node";
const once = (text: string, from: string, to: string): string => {
  expect([from, text.split(from).length - 1]).toStrictEqual([from, 1]);
  return text.replace(from, to);
};

test("Code Acceptance example 1: unchanged without allowed", () => {
  expect(codeAcceptance(ctx({}), "// probe\n", null, null)).toBe(fixture("builder/code1.txt"));
});

test("Code Acceptance example 3: allowArg and the guard line with the declared packages", () => {
  expect([allowArg([]), allowArg(["zod"]), allowArg(["yaml", "@scope/pkg"])]).toStrictEqual(["", " 'zod'", " 'yaml,@scope/pkg'"]);
  expect(codeAcceptance(ctx({ allowed: ["yaml", "@scope/pkg"] }), "// probe\n", null, null))
    .toBe(once(fixture("builder/code1.txt"), G1, "echo '== guard'; node $P/guard.mjs src src/x/a.ts 'yaml,@scope/pkg'\n"));
  expect(codeAcceptance(ctx2({ allowed: ["ajv"], vendor: true }), "// probe\n", 5, "echo '== bin'; true\n"))
    .toBe(once(fixture("builder/code2.txt"), G2, "guard.mjs src src/x/a.ts 'ajv'; node"));
  expect(codeAcceptance(ctx({ allowed: [], vendor: false }), "// probe\n", null, null)).toBe(fixture("builder/code1.txt"));
});

test("Judge Acceptance example 4: a judge reads neither allowed nor vendor", () => {
  const files: JudgeFile[] = [{ file: "tests/x/a.examples.test.ts", min: 2, max: 10, lits: ["x \"y\"", "z"], drop: [], new: true }];
  const j = ctx({ id: "a-judge", targets: ["tests/x/a.examples.test.ts"], allowed: ["zod"], vendor: true });
  expect(judgeAcceptance(j, files)).toBe(fixture("builder/judge1.txt"));
});

test("row: the order given is kept, nothing sorted or deduplicated here; vendor alone changes nothing; the input type", () => {
  expect(allowArg(["zod", "ajv", "zod"])).toBe(" 'zod,ajv,zod'");
  expect(codeAcceptance(ctx({ vendor: true }), "// probe\n", null, null)).toBe(fixture("builder/code1.txt"));
  const multi = codeAcceptance(ctx({ targets: ["src/x/a.ts", "src/x/c.ts"], allowed: ["q", "p"] }), "// probe\n", null, null);
  expect(multi.includes("echo '== guard'; node $P/guard.mjs src src/x/a.ts,src/x/c.ts 'q,p'\n")).toBe(true);
  const input: BuildInput = { cards: [], checks: { version: 1, phase: "p", parts: "x", frozen: [], fullExclude: [], ownGit: false, cards: [] },
    profile: TYPESCRIPT, texts: { guard: "", firstdiff: "", probes: {} }, uses: { a: ["b"] }, vendor: true };
  expect([input.uses, input.vendor]).toStrictEqual([{ a: ["b"] }, true]);
});
