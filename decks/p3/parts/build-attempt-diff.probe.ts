// P3 probe for build-attempt-diff: buildAttemptDiff by docs/TASK_P3_acceptance.md §2.2, one
// test per record example, values and types. Pure: no root, no spawn.
import { test, expect } from "vitest";
import { DIFF_CAP, buildAttemptDiff } from "../../src/acceptance/diff.js";
import { fixture } from "../../tests/helpers.js";

function lines(n: number, change: Record<number, string> = {}): string {
  let s = "";
  for (let i = 1; i <= n; i += 1) s += (change[i] ?? `line ${i}`) + "\n";
  return s;
}

test("Build Attempt Diff example 1: line 5 of 10 changed, one hunk with 3 lines of context", () => {
  const got: string = buildAttemptDiff({ "src/a.ts": lines(10) }, { "src/a.ts": lines(10, { 5: "LINE 5" }) });
  expect(got, "the exact unified diff").toBe(
    "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -2,7 +2,7 @@\n line 2\n line 3\n line 4\n-line 5\n+LINE 5\n line 6\n line 7\n line 8\n");
});

test("Build Attempt Diff example 2: a new file is diffed against /dev/null, an unchanged one is not mentioned", () => {
  const got = buildAttemptDiff({ "src/a.ts": "a\nb\n", "src/b.ts": null }, { "src/a.ts": "a\nb\n", "src/b.ts": "x\n" });
  expect(got, "only src/b.ts").toBe("--- /dev/null\n+++ b/src/b.ts\n@@ -0,0 +1,1 @@\n+x\n");
  expect(buildAttemptDiff({}, { "src/c.ts": "c\n" }), "a key missing from before is absent")
    .toBe("--- /dev/null\n+++ b/src/c.ts\n@@ -0,0 +1,1 @@\n+c\n");
  expect(buildAttemptDiff({ "src/a.ts": "a\n" }, { "src/a.ts": "a\n" }), "no change at all").toBe("");
});

test("Build Attempt Diff example 3: two distant changes give two hunks", () => {
  const got = buildAttemptDiff({ t: lines(20) }, { t: lines(20, { 2: "LINE 2", 18: "LINE 18" }) });
  expect(got, "two hunks").toBe(
    "--- a/t\n+++ b/t\n@@ -1,5 +1,5 @@\n line 1\n-line 2\n+LINE 2\n line 3\n line 4\n line 5\n" +
    "@@ -15,6 +15,6 @@\n line 15\n line 16\n line 17\n-line 18\n+LINE 18\n line 19\n line 20\n");
  const near = buildAttemptDiff({ t: lines(20) }, { t: lines(20, { 2: "LINE 2", 9: "LINE 9" }) });
  expect(near.split("\n").filter((l) => l.startsWith("@@")).join(" | "),
    "changes 6 unchanged lines apart share one hunk").toBe("@@ -1,12 +1,12 @@");
});

test("Build Attempt Diff example 4: over 6000 chars the diff is clipped to exactly 6000", () => {
  const after = fixture("acceptance/bigAfter.txt");
  expect(after.length, "bigAfter.txt is 9890 chars").toBe(9890);
  const got = buildAttemptDiff({ "src/big.ts": null }, { "src/big.ts": after });
  expect(got.length, "exactly DIFF_CAP chars").toBe(DIFF_CAP);
  expect(DIFF_CAP, "the constant").toBe(6000);
  expect(got.startsWith("--- /dev/null\n+++ b/src/big.ts\n@@ -0,0 +1,400 @@\n+export const v000 = 0;\n"), "the head")
    .toBe(true);
  expect(got.endsWith("+export const v231 = 231;\n\n[diff clipped: 10339 chars]\n"), "ends with the clip line").toBe(true);
});
