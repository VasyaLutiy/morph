// tests/acceptance/diff.examples.test.ts — the judge's test of Build Attempt Diff
// (TASK_P3 §2.2, src/acceptance/diff.ts). One test per record example of the
// Function, in record order, then tests of the rules of §2.2 on inputs whose
// diff is unique. The Function is pure: it takes no root, so no root is opened,
// nothing is written anywhere, and the fixture is read only.

import { expect, test } from "vitest";

import { DIFF_CAP, buildAttemptDiff } from "../../src/acceptance/diff.js";
import { fixture } from "../helpers.js";

/** "line 1\n" … "line <n>\n", with the given 1-based lines replaced. */
function lineText(
  n: number,
  changed: Readonly<Record<number, string>> = {},
): string {
  let out = "";
  for (let i = 1; i <= n; i++) {
    const line: string = changed[i] ?? "line " + i;
    out += line + "\n";
  }
  return out;
}

// Build Attempt Diff example 1: line 5 of a 10-line file rewritten.
test("Build Attempt Diff example 1: one changed line of ten", () => {
  const before: Record<string, string | null> = { "src/a.ts": lineText(10) };
  const after: Record<string, string> = {
    "src/a.ts": lineText(10, { 5: "LINE 5" }),
  };
  expect(buildAttemptDiff(before, after)).toBe(
    "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -2,7 +2,7 @@\n" +
      " line 2\n line 3\n line 4\n-line 5\n+LINE 5\n line 6\n line 7\n line 8\n",
  );
});

// Build Attempt Diff example 2: src/b.ts is new, src/a.ts is unchanged.
test("Build Attempt Diff example 2: a new file, the unchanged one is not mentioned", () => {
  const before: Record<string, string | null> = {
    "src/a.ts": "a\nb\n",
    "src/b.ts": null,
  };
  const after: Record<string, string> = {
    "src/a.ts": "a\nb\n",
    "src/b.ts": "x\n",
  };
  expect(buildAttemptDiff(before, after)).toBe(
    "--- /dev/null\n+++ b/src/b.ts\n@@ -0,0 +1,1 @@\n+x\n",
  );
});

// Build Attempt Diff example 3: lines 2 and 18 of a 20-line file rewritten.
test("Build Attempt Diff example 3: two changed lines of twenty give two hunks", () => {
  const before: Record<string, string | null> = { t: lineText(20) };
  const after: Record<string, string> = {
    t: lineText(20, { 2: "LINE 2", 18: "LINE 18" }),
  };
  expect(buildAttemptDiff(before, after)).toBe(
    "--- a/t\n+++ b/t\n" +
      "@@ -1,5 +1,5 @@\n line 1\n-line 2\n+LINE 2\n line 3\n line 4\n line 5\n" +
      "@@ -15,6 +15,6 @@\n line 15\n line 16\n line 17\n-line 18\n+LINE 18\n line 19\n line 20\n",
  );
});

// Build Attempt Diff example 4: a new 400-line file, clipped to DIFF_CAP.
test("Build Attempt Diff example 4: a new 400-line file is clipped to exactly DIFF_CAP", () => {
  const before: Record<string, string | null> = { "src/big.ts": null };
  const after: Record<string, string> = {
    "src/big.ts": fixture("acceptance/bigAfter.txt"),
  };
  const diff: string = buildAttemptDiff(before, after);
  expect(diff.length).toBe(DIFF_CAP);
  expect(
    diff.startsWith(
      "--- /dev/null\n+++ b/src/big.ts\n@@ -0,0 +1,400 @@\n+export const v000 = 0;\n",
    ),
  ).toBe(true);
  expect(diff.endsWith("\n[diff clipped: 10339 chars]\n")).toBe(true);
});

// Own tests on §2.2, on inputs whose diff is unique.

test("DIFF_CAP is 6000", () => {
  expect(DIFF_CAP).toBe(6000);
});

test("nothing changed gives the empty string, including the no-change shapes of rule 1", () => {
  expect(buildAttemptDiff({ "src/a.ts": "a\nb\n" }, { "src/a.ts": "a\nb\n" })).toBe("");
  expect(buildAttemptDiff({ "src/a.ts": null }, { "src/a.ts": "" })).toBe("");
  expect(buildAttemptDiff({ "src/a.ts": "a\n" }, { "src/a.ts": "a" })).toBe("");
});

test("one rewritten line: the changed old line is a minus, never context", () => {
  expect(buildAttemptDiff({ "src/a.ts": "old\n" }, { "src/a.ts": "bad\n" })).toBe(
    "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,1 +1,1 @@\n-old\n+bad\n",
  );
});

test("a deletion at the top still starts both sides at line 1", () => {
  expect(buildAttemptDiff({ t: "a\nb\n" }, { t: "b\n" })).toBe(
    "--- a/t\n+++ b/t\n@@ -1,2 +1,1 @@\n-a\n b\n",
  );
});

test("an addition at the end of a kept line", () => {
  expect(buildAttemptDiff({ n: "a\n" }, { n: "a\nb\n" })).toBe(
    "--- a/n\n+++ b/n\n@@ -1,1 +1,2 @@\n a\n+b\n",
  );
});

test("a file emptied to a single deletion: the new count is zero", () => {
  expect(buildAttemptDiff({ x: "z\n" }, { x: "" })).toBe(
    "--- a/x\n+++ b/x\n@@ -1,1 +0,0 @@\n-z\n",
  );
});

test("line 1 of ten changed: three context lines after, none before", () => {
  expect(buildAttemptDiff({ t: lineText(10) }, { t: lineText(10, { 1: "LINE 1" }) })).toBe(
    "--- a/t\n+++ b/t\n@@ -1,4 +1,4 @@\n-line 1\n+LINE 1\n line 2\n line 3\n line 4\n",
  );
});

test("two changes with six context lines between share one hunk", () => {
  expect(
    buildAttemptDiff({ t: lineText(20) }, { t: lineText(20, { 2: "LINE 2", 9: "LINE 9" }) }),
  ).toBe(
    "--- a/t\n+++ b/t\n@@ -1,12 +1,12 @@\n line 1\n-line 2\n+LINE 2\n" +
      " line 3\n line 4\n line 5\n line 6\n line 7\n line 8\n" +
      "-line 9\n+LINE 9\n line 10\n line 11\n line 12\n",
  );
});

test("two new files appear in Object.keys order", () => {
  expect(buildAttemptDiff({}, { "src/b.ts": "b\n", "src/a.ts": "a\n" })).toBe(
    "--- /dev/null\n+++ b/src/b.ts\n@@ -0,0 +1,1 @@\n+b\n" +
      "--- /dev/null\n+++ b/src/a.ts\n@@ -0,0 +1,1 @@\n+a\n",
  );
});
