// P9c probe for build-attempt-diff: buildAttemptDiff by docs/TASK_P9c_retry.md §2.2 (rule 5, the clip
// per file section, head and tail by whole lines). Examples 1-3 (rules 1-4, unchanged) as the P3 probe,
// examples 4-5 (new) exactly, then the §2.2 rows: a small section next to a big one, the cap boundary,
// and a tail line too long for the budget. Pure: no root, no spawn.
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
  expect(buildAttemptDiff({ "src/a.ts": "old\n" }, { "src/a.ts": "bad\n" }),
    "a hunk opening with a deletion at the top starts at +1 (TASK 2.2 rule 4)")
    .toBe("--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,1 +1,1 @@\n-old\n+bad\n");
  expect(buildAttemptDiff({ t: "a\nb\n" }, { t: "b\n" }), "a deletion of line 1: new side starts at 1")
    .toBe("--- a/t\n+++ b/t\n@@ -1,2 +1,1 @@\n-a\n b\n");
  expect(buildAttemptDiff({ t: lines(10) }, { t: lines(10, { 1: "LINE 1" }) }).split("\n")[2],
    "line 1 of 10 changed").toBe("@@ -1,4 +1,4 @@");
});

const BIG = (): string => fixture("acceptance/bigAfter.txt");
const plus = (from: number, to: number): string => {
  const ls = BIG().split("\n").slice(0, 400);
  return ls.slice(from, to + 1).map((l) => "+" + l + "\n").join("");
};
const MARK = "... [4420 characters elided] ...\n";
const clipped = (p: string): string =>
  "--- /dev/null\n+++ b/" + p + "\n@@ -0,0 +1,400 @@\n" + plus(0, 115) + MARK + plus(286, 399);

test("Build Attempt Diff example 4: a 10339-char section keeps 119 head lines and 114 tail lines", () => {
  expect(BIG().length, "bigAfter.txt is 9890 chars").toBe(9890);
  const got = buildAttemptDiff({ "src/big.ts": null }, { "src/big.ts": BIG() });
  expect(got.length, "length").toBe(5952);
  expect(got.split("\n").length - 1, "lines").toBe(234);
  expect(got.includes("[diff clipped"), "the old marker is gone").toBe(false);
  expect(got.includes("+export const v115 = 115;\n" + MARK + "+export const v286 = 286;\n"), "head, marker, tail").toBe(true);
  expect(got, "the exact clipped section").toBe(clipped("src/big.ts"));
  expect(DIFF_CAP, "the constant").toBe(6000);
});

test("Build Attempt Diff example 5: two big files, each section clipped on its own", () => {
  const got = buildAttemptDiff({ "src/a.ts": null, "src/b.ts": null }, { "src/a.ts": BIG(), "src/b.ts": BIG() });
  expect(got.length, "length").toBe(11900);
  expect(got.slice(0, 5950).endsWith("+export const v399 = 399;\n"), "src/a.ts keeps its tail").toBe(true);
  expect(got.slice(5950).startsWith("--- /dev/null\n+++ b/src/b.ts\n"), "src/b.ts starts at 5950").toBe(true);
  expect(got.split(MARK).length - 1, "two markers").toBe(2);
  expect(got, "the two clipped sections").toBe(clipped("src/a.ts") + clipped("src/b.ts"));
});

test("§2.2: a small section is kept whole next to a clipped one, in key order", () => {
  const got = buildAttemptDiff({ s: null, "src/big.ts": null }, { s: "x\n", "src/big.ts": BIG() });
  expect(got, "small then big").toBe("--- /dev/null\n+++ b/s\n@@ -0,0 +1,1 @@\n+x\n" + clipped("src/big.ts"));
});

test("§2.2: a section of exactly DIFF_CAP chars is whole, one char more is clipped", () => {
  // header "--- /dev/null\n+++ b/f\n" (22) + "@@ -0,0 +1,100 @@\n" (18) + 100 lines "+<text>\n"
  const body = (last: number): string => ("a".repeat(58) + "\n").repeat(99) + "b".repeat(last) + "\n";
  const at = buildAttemptDiff({ f: null }, { f: body(18) });
  expect(at.length, "6000 chars, whole").toBe(6000);
  expect(at.includes("characters elided"), "not clipped at 6000").toBe(false);
  const over = buildAttemptDiff({ f: null }, { f: body(19) });
  expect(over.includes("characters elided] ...\n"), "clipped at 6001").toBe(true);
  expect(over.length <= DIFF_CAP, "within the cap").toBe(true);
});

test("§2.2: a last line longer than the budget leaves the tail empty; the marker line ends the section", () => {
  const short = Array.from({ length: 10 }, (_, i) => "l" + i + "\n").join("");
  const got = buildAttemptDiff({ f: null }, { f: short + "z".repeat(7000) + "\n" });
  const head = "--- /dev/null\n+++ b/f\n@@ -0,0 +1,11 @@\n" + short.split("\n").slice(0, 10).map((l) => "+" + l + "\n").join("");
  const L = head.length + 7002;
  expect(got, "head, marker, no tail").toBe(head + "... [" + (L - head.length) + " characters elided] ...\n");
});
