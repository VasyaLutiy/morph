import { expect, test } from "vitest";
import { buildAttemptDiff } from "../../src/acceptance/diff.js";

test("Build Attempt Diff example 6", () => {
  const before: Record<string, string | null> = {
    "big.txt": Array.from({ length: 4001 }, (_, i) => "old " + i).join("\n"),
  };
  const after: Record<string, string> = {
    "big.txt": Array.from({ length: 4000 }, (_, i) => "new " + i).join("\n"),
  };
  expect(buildAttemptDiff(before, after)).toBe(
    "--- a/big.txt\n+++ b/big.txt\n" +
      "... [diff skipped: 4001 -> 4000 lines] ...\n",
  );
});

test("Build Attempt Diff example 7", () => {
  const before: Record<string, string | null> = {
    "src/c.ts": Array.from({ length: 4000 }, (_, i) => "c " + i).join("\n"),
  };
  const after: Record<string, string> = {
    "src/c.ts": Array.from(
      { length: 4000 },
      (_, i) => (i === 3999 ? "C 3999" : "c " + i),
    ).join("\n"),
  };
  expect(buildAttemptDiff(before, after)).toBe(
    "--- a/src/c.ts\n+++ b/src/c.ts\n@@ -3997,4 +3997,4 @@\n" +
      " c 3996\n c 3997\n c 3998\n-c 3999\n+C 3999\n",
  );
});
