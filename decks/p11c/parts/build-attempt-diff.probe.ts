// P11c probe for build-attempt-diff by docs/TASK_P11c_runner.md §2.2 (issue #5 finding 8) — a file whose before and
// after line counts multiply to more than 16 000 000 gets its two header lines and "... [diff skipped: <before lines>
// -> <after lines> lines] ...\n" instead of hunks, and the LCS table is never built. Record Build Attempt Diff examples
// 6-7, then the §2.2 rows.
import { test, expect } from "vitest";
import { buildAttemptDiff, DIFF_CAP, DIFF_LCS_CAP } from "../../src/acceptance/diff.js";

const lines = (n: number, f: (i: number) => string): string => Array.from({ length: n }, (_, i) => f(i) + "\n").join("");

test("Build Attempt Diff example 6: 4001 x 4000 lines skips the line diff", () => {
  const got = buildAttemptDiff({ "big.txt": lines(4001, (i) => "old " + i) }, { "big.txt": lines(4000, (i) => "new " + i) });
  expect(got).toBe("--- a/big.txt\n+++ b/big.txt\n... [diff skipped: 4001 -> 4000 lines] ...\n");
});

test("Build Attempt Diff example 7: 4000 x 4000 lines is still diffed", () => {
  const before = lines(4000, (i) => "c " + i);
  const got = buildAttemptDiff({ "src/c.ts": before }, { "src/c.ts": before.replace("c 3999\n", "C 3999\n") });
  expect(got).toBe("--- a/src/c.ts\n+++ b/src/c.ts\n@@ -3997,4 +3997,4 @@\n c 3996\n c 3997\n c 3998\n-c 3999\n+C 3999\n");
});

test("§2.2 rows: the cap is a product of line counts; an absent side; per file; equal files; the cap exported", () => {
  const big = lines(20000, (i) => "n" + i);
  const fresh = buildAttemptDiff({ "gen/n.txt": null }, { "gen/n.txt": big });
  expect(`${fresh.length} ${fresh.includes("diff skipped")} ${fresh.startsWith("--- /dev/null\n+++ b/gen/n.txt\n@@ -0,0 +1,20000 @@\n+n0\n")}`,
    "0 x 20000: clipped, not skipped").toBe(`5959 false true`);
  expect(`${DIFF_CAP} ${DIFF_LCS_CAP}`, "the section cap unchanged; the LCS cap exported").toBe("6000 16000000");
  const wide = buildAttemptDiff({ w: lines(2, (i) => "w" + i) }, { w: lines(8000001, () => "") });
  expect(wide, "2 x 8000001").toBe("--- a/w\n+++ b/w\n... [diff skipped: 2 -> 8000001 lines] ...\n");
  const two = buildAttemptDiff(
    { "z.txt": lines(5000, (i) => "z" + i), "s.ts": "a\n" },
    { "z.txt": lines(3201, (i) => "Z" + i), "s.ts": "b\n" });
  expect(two, "per file, key order").toBe("--- a/z.txt\n+++ b/z.txt\n... [diff skipped: 5000 -> 3201 lines] ...\n" +
    "--- a/s.ts\n+++ b/s.ts\n@@ -1,1 +1,1 @@\n-a\n+b\n");
  const same = lines(5000, (i) => "s" + i);
  expect(buildAttemptDiff({ e: same }, { e: same }), "equal files contribute nothing").toBe("");
});
