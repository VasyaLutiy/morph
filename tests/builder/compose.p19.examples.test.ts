import { expect, test } from "vitest";
import { allowArg, codeAcceptance, judgeAcceptance } from "../../src/builder/compose.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture } from "../helpers.js";
import type { CardContext, JudgeFile } from "../../src/builder/types.js";

const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "a", phase: "p1", targets: ["src/x/a.ts"], siblings: ["src/x/b.ts"], frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false,
  profile: TYPESCRIPT, guard: "// guard\n", firstdiff: "// firstdiff\n", ...over,
});

test("Code Acceptance example 3: the allowed list is the guard's third argument", () => {
  const code1 = fixture("builder/code1.txt");
  const code2 = fixture("builder/code2.txt");
  expect(allowArg([])).toBe("");
  expect(allowArg(["zod"])).toBe(" 'zod'");
  expect(allowArg(["yaml", "@scope/pkg"])).toBe(" 'yaml,@scope/pkg'");
  expect(codeAcceptance(ctx({ allowed: ["yaml", "@scope/pkg"] }), "// probe\n", null, null)).toBe(
    code1.replace(
      "echo '== guard'; node $P/guard.mjs src src/x/a.ts",
      "echo '== guard'; node $P/guard.mjs src src/x/a.ts 'yaml,@scope/pkg'",
    ),
  );
  expect(
    codeAcceptance(
      ctx({
        id: "a",
        phase: "p2",
        targets: ["src/x/a.ts", "tests/x/a.test.ts"],
        siblings: [],
        fullExclude: ["tests/x/old.test.ts"],
        ownGit: true,
        allowed: ["ajv"],
        vendor: true,
      }),
      "// probe\n",
      5,
      "echo '== bin'; true\n",
    ),
  ).toBe(code2.replace("guard.mjs src src/x/a.ts; node", "guard.mjs src src/x/a.ts 'ajv'; node"));
  expect(codeAcceptance(ctx({ allowed: [], vendor: false }), "// probe\n", null, null)).toBe(code1);
});

test("Judge Acceptance example 4: a judge's acceptance names no packages", () => {
  const files: JudgeFile[] = [
    { file: "tests/x/a.examples.test.ts", min: 2, max: 10, lits: ['x "y"', "z"], drop: [], new: true },
  ];
  expect(
    judgeAcceptance(
      ctx({ id: "a-judge", targets: ["tests/x/a.examples.test.ts"], allowed: ["zod"], vendor: true }),
      files,
    ),
  ).toBe(fixture("builder/judge1.txt"));
});
