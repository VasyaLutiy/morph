// P30 probe for compose by docs/TASK_P30_rules.md §2.2 (src/builder/compose.ts) — issue #41: the code card's guard
// line carries the record's layers after allowArg. Record Code Acceptance example 4 (examples.json).
import { test, expect } from "vitest";
import { codeAcceptance } from "../../src/builder/compose.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture } from "../../tests/helpers.js";
import type { CardContext } from "../../src/builder/types.js";

const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "a", phase: "p1", targets: ["src/x/a.ts"], siblings: ["src/x/b.ts"], frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false,
  profile: TYPESCRIPT, guard: "// guard\n", firstdiff: "// firstdiff\n", ...over,
});
const LINE = "echo '== guard'; node $P/guard.mjs src src/x/a.ts";

test("Code Acceptance example 4: the layers argument follows allowArg's", () => {
  const code1 = fixture("builder/code1.txt");
  const code2 = fixture("builder/code2.txt");
  expect(codeAcceptance(ctx({ layers: { "src/x": ["src/y"] } }), "// probe\n", null, null)).toBe(
    code1.replace(LINE, LINE + " '' '{\"src/x\":[\"src/y\"]}'"),
  );
  expect(codeAcceptance(ctx({ allowed: ["zod"], layers: { "src/x": [] } }), "// probe\n", null, null)).toBe(
    code1.replace(LINE, LINE + " 'zod' '{\"src/x\":[]}'"),
  );
  const two = ctx({ phase: "p2", targets: ["src/x/a.ts", "tests/x/a.test.ts"], siblings: [], fullExclude: ["tests/x/old.test.ts"], ownGit: true, layers: { "src/x": [] } });
  expect(codeAcceptance(two, "// probe\n", 5, "echo '== bin'; true\n")).toBe(
    code2.replace("guard.mjs src src/x/a.ts; node", "guard.mjs src src/x/a.ts '' '{\"src/x\":[]}'; node"),
  );
});
