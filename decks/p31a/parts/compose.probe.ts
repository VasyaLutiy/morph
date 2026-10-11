// P31a probe for compose by docs/TASK_P31a_guardrails.md §2.2 (src/builder/compose.ts) — issue #42: the code card's
// guard line carries the record's rules after the layers. Record Code Acceptance example 5 (examples.json).
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

test("Code Acceptance example 5: the rules argument follows the layers argument", () => {
  const code1 = fixture("builder/code1.txt");
  const code2 = fixture("builder/code2.txt");
  expect(codeAcceptance(ctx({ layers: { "src/x": ["src/y"] }, rules: { "src/x": { "no-clock": "Guardrail 'No Clock' of Component x" } } }), "// probe\n", null, null)).toBe(
    code1.replace(LINE, LINE + " '' '{\"src/x\":[\"src/y\"]}' '{\"src/x\":{\"no-clock\":\"Guardrail \\u0027No Clock\\u0027 of Component x\"}}'"),
  );
  expect(codeAcceptance(ctx({ allowed: ["zod"], layers: { "src/x": [] }, rules: {} }), "// probe\n", null, null)).toBe(
    code1.replace(LINE, LINE + " 'zod' '{\"src/x\":[]}' '{}'"),
  );
  const two = ctx({ phase: "p2", targets: ["src/x/a.ts", "tests/x/a.test.ts"], siblings: [], fullExclude: ["tests/x/old.test.ts"], ownGit: true, layers: { "src/x": [] }, rules: { "src/x": {} } });
  expect(codeAcceptance(two, "// probe\n", 5, "echo '== bin'; true\n")).toBe(
    code2.replace("guard.mjs src src/x/a.ts; node", "guard.mjs src src/x/a.ts '' '{\"src/x\":[]}' '{\"src/x\":{}}'; node"),
  );
  expect(codeAcceptance(ctx({ layers: { "src/x": ["src/y"] } }), "// probe\n", null, null)).toBe(
    code1.replace(LINE, LINE + " '' '{\"src/x\":[\"src/y\"]}'"),
  );
});
