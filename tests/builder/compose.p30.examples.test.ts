import { expect, test } from "vitest";
import { codeAcceptance } from "../../src/builder/compose.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture } from "../helpers.js";
import type { CardContext } from "../../src/builder/types.js";

const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "a", phase: "p1", targets: ["src/x/a.ts"], siblings: ["src/x/b.ts"], frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false,
  profile: TYPESCRIPT, guard: "// guard\n", firstdiff: "// firstdiff\n", ...over,
});

test("Code Acceptance example 4: the layers object is the guard's fourth argument, after the allowed list", () => {
  const code1 = fixture("builder/code1.txt");
  const code2 = fixture("builder/code2.txt");
  expect(codeAcceptance(ctx({ layers: { "src/x": ["src/y"] } }), "// probe\n", null, null)).toBe(
    code1.replace(
      "echo '== guard'; node $P/guard.mjs src src/x/a.ts",
      "echo '== guard'; node $P/guard.mjs src src/x/a.ts '' '{\"src/x\":[\"src/y\"]}'",
    ),
  );
  expect(codeAcceptance(ctx({ allowed: ["zod"], layers: { "src/x": [] } }), "// probe\n", null, null)).toBe(
    code1.replace(
      "echo '== guard'; node $P/guard.mjs src src/x/a.ts",
      "echo '== guard'; node $P/guard.mjs src src/x/a.ts 'zod' '{\"src/x\":[]}'",
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
        layers: { "src/x": [] },
      }),
      "// probe\n",
      5,
      "echo '== bin'; true\n",
    ),
  ).toBe(
    code2.replace(
      "guard.mjs src src/x/a.ts; node",
      "guard.mjs src src/x/a.ts '' '{\"src/x\":[]}'; node",
    ),
  );
});
