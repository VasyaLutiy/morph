import { test, expect } from "vitest";
import { fullStep, RELATED_LINE } from "../../src/builder/compose.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture } from "../helpers.js";
import type { CardContext } from "../../src/builder/types.js";

const ctx1: CardContext = {
  id: "a",
  phase: "p1",
  targets: ["src/x/a.ts"],
  siblings: ["src/x/b.ts"],
  frozen: DEFAULT_FROZEN,
  fullExclude: [],
  ownGit: false,
  profile: TYPESCRIPT,
  guard: "// guard\n",
  firstdiff: "// firstdiff\n",
};

const ctx2: CardContext = {
  id: "a",
  phase: "p2",
  targets: ["src/x/a.ts", "tests/x/a.test.ts"],
  siblings: [],
  frozen: DEFAULT_FROZEN,
  fullExclude: ["tests/x/old.test.ts"],
  ownGit: true,
  profile: TYPESCRIPT,
  guard: "// guard\n",
  firstdiff: "// firstdiff\n",
};

function fullLine(name: string): string {
  const line = fixture(name)
    .split("\n")
    .filter((l) => l.startsWith("echo '== full'; "))[0];
  return line + "\n";
}

test("Code Acceptance example 6: RELATED_LINE", () => {
  expect(RELATED_LINE).toBe("node_modules/.bin/vitest related --run {test} --reporter=dot");
});

test("Code Acceptance example 6: fullStep of the ctx of example 1", () => {
  const step = fullStep(ctx1);
  expect(step).toBe(fullLine("builder/code1.txt"));
  expect(step).toContain("vitest related --run src/x/a.ts --passWithNoTests --reporter=dot");
});

test("Code Acceptance example 6: fullStep of the ctx of example 2", () => {
  const step = fullStep(ctx2);
  expect(step).toBe(fullLine("builder/code2.txt"));
  expect(step).toContain(
    "vitest related --run src/x/a.ts tests/x/a.test.ts --passWithNoTests --exclude tests/x/old.test.ts --reporter=dot",
  );
});
