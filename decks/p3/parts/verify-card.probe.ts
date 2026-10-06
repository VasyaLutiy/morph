// P3 probe for verify-card: verifyCard by docs/TASK_P3_acceptance.md §2.2, one test per record
// example, values and types. Runs from probe/verify-card/ under vitest; every example spawns
// the real command in its own tmpRoot() holding src/a.ts = "old\n".
import { test, expect } from "vitest";
import { verifyCard } from "../../src/acceptance/verify.js";
import type { VariantAnswer, VariantResult, VerifyInput, VerifyOutcome } from "../../src/acceptance/types.js";
import type { ParsedAnswer } from "../../src/compiler/types.js";
import { tmpRoot } from "../../tests/helpers.js";
import type { TmpRoot } from "../../tests/helpers.js";

const COMMAND = 'grep good src/a.ts || { echo "FAIL: no good in src/a.ts"; exit 1; }';
const ENV: Record<string, string> = { PATH: "/usr/bin:/bin" };
const DIFF_A = "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,1 +1,1 @@\n-old\n+bad\n";

function input(r: TmpRoot, targets: string[], variants: [string, ParsedAnswer][]): VerifyInput {
  const vs: VariantAnswer[] = variants.map(([variant, answer]) => ({ variant, answer }));
  return { root: r.root, targets, command: COMMAND, variants: vs, env: ENV };
}
const row = (x: VariantResult | undefined): string =>
  x === undefined ? "missing" : `${x.variant} ${x.exit} ${JSON.stringify(x.log)} ${JSON.stringify(x.diff)}`;

test("Verify Card example 1: corrupt skipped, red rolled back with its diff, the first green stays", async () => {
  const r = tmpRoot();
  try {
    r.write("src/a.ts", "old\n");
    const got: VerifyOutcome = await verifyCard(input(r, ["src/a.ts"], [
      ["c.v1", { corrupt: "missing section for src/a.ts" }],
      ["c.v2", { files: { "src/a.ts": "bad\n" } }],
      ["c.v3", { files: { "src/a.ts": "good\n" } }],
    ]));
    expect(JSON.stringify(got.accepted), "accepted c.v3").toBe('{"variant":"c.v3"}');
    expect(got.results.length, "three results").toBe(3);
    expect(row(got.results[0]), "c.v1 stand-in").toBe('c.v1 null "answer corrupt: missing section for src/a.ts" null');
    expect(row(got.results[1]), "c.v2 red with its diff").toBe(`c.v2 1 "FAIL: no good in src/a.ts\\n" ${JSON.stringify(DIFF_A)}`);
    expect(row(got.results[2]), "c.v3 green").toBe('c.v3 0 "good\\n" null');
    expect(r.read("src/a.ts"), "the winner's file stays").toBe("good\n");
  } finally {
    r.rm();
  }
});

test("Verify Card example 2: nothing green, the tree equals the snapshot", async () => {
  const r = tmpRoot();
  try {
    r.write("src/a.ts", "old\n");
    const got = await verifyCard(input(r, ["src/a.ts", "src/b.ts"], [
      ["c.v1", { truncated: true }],
      ["c.v2", { files: { "src/a.ts": "bad\n", "src/b.ts": "x\n" } }],
    ]));
    expect(got.accepted, "accepted null").toBe(null);
    expect(got.results.length, "two results").toBe(2);
    expect(row(got.results[0]), "c.v1 stand-in").toBe('c.v1 null "answer truncated" null');
    expect(row(got.results[1]), "c.v2 red, the diff of both files").toBe(
      `c.v2 1 "FAIL: no good in src/a.ts\\n" ${JSON.stringify(DIFF_A + "--- /dev/null\n+++ b/src/b.ts\n@@ -0,0 +1,1 @@\n+x\n")}`);
    expect(r.read("src/a.ts"), "src/a.ts restored").toBe("old\n");
    expect(r.exists("src/b.ts"), "src/b.ts does not exist").toBe(false);
  } finally {
    r.rm();
  }
});

test("Verify Card example 3: the first green stops, later variants never run", async () => {
  const r = tmpRoot();
  try {
    r.write("src/a.ts", "old\n");
    const got = await verifyCard(input(r, ["src/a.ts"], [
      ["c.v1", { files: { "src/a.ts": "good\n" } }],
      ["c.v2", { files: { "src/a.ts": "good\n" } }],
    ]));
    expect(JSON.stringify(got.accepted), "accepted c.v1").toBe('{"variant":"c.v1"}');
    expect(got.results.map((x) => `${x.variant}:${x.exit}`).join(","), "exactly one entry").toBe("c.v1:0");
    const none = await verifyCard(input(r, ["src/a.ts"], []));
    expect(JSON.stringify(none), "no variants").toBe('{"accepted":null,"results":[]}');
  } finally {
    r.rm();
  }
});
