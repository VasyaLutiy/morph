// P10c probe for verify-card: verifyCard and TRUNCATED_RESPONSE_MESSAGE by docs/TASK_P10c_runner.md §2.2 (issue #3 C7)
// — a truncated answer's stand-in log is the old runner's three sentences. Record Verify Card examples 2 and 4, then the
// §2.2 rows (corrupt unchanged, nothing written, the type).
import { test, expect, expectTypeOf } from "vitest";
import { TRUNCATED_RESPONSE_MESSAGE, verifyCard } from "../../src/acceptance/verify.js";
import { tmpRoot } from "../../tests/helpers.js";

const COMMAND = 'grep good src/a.ts || { echo "FAIL: no good in src/a.ts"; exit 1; }';
const ENV: Record<string, string> = { PATH: "/usr/bin:/bin" };
const OLD_TEXT = "The previous answer was cut off mid-file: it opened a ``` code fence and never closed it, so the file body " +
  "could not be extracted. Answer again with the COMPLETE file, and close the fence.";

test("Verify Card example 4: TRUNCATED_RESPONSE_MESSAGE is the old runner's text, 188 chars", () => {
  expect(TRUNCATED_RESPONSE_MESSAGE, "text").toBe(OLD_TEXT);
  expect(TRUNCATED_RESPONSE_MESSAGE.length, "length").toBe(188);
  expect(TRUNCATED_RESPONSE_MESSAGE.includes("answer truncated"), "old V2 words").toBe(false);
  expectTypeOf(TRUNCATED_RESPONSE_MESSAGE).toEqualTypeOf<string>();
});

test("Verify Card example 2: the truncated stand-in, then a rejected two-file variant, leaves the snapshot", async () => {
  const r = tmpRoot("morph-p10c-");
  try {
    r.write("src/a.ts", "old\n");
    const out = await verifyCard({ root: r.root, targets: ["src/a.ts", "src/b.ts"], command: COMMAND, env: ENV, variants: [
      { variant: "c.v1", answer: { truncated: true } },
      { variant: "c.v2", answer: { files: { "src/a.ts": "bad\n", "src/b.ts": "x\n" } } }] });
    expect(out, "outcome").toStrictEqual({ accepted: null, results: [
      { variant: "c.v1", exit: null, log: OLD_TEXT, diff: null },
      { variant: "c.v2", exit: 1, log: "FAIL: no good in src/a.ts\n",
        diff: "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,1 +1,1 @@\n-old\n+bad\n--- /dev/null\n+++ b/src/b.ts\n@@ -0,0 +1,1 @@\n+x\n" }] });
    expect(r.read("src/a.ts"), "a rolled back").toBe("old\n");
    expect(r.exists("src/b.ts"), "b removed").toBe(false);
  } finally {
    r.rm();
  }
});

test("§2.2: the corrupt stand-in is unchanged and neither stand-in writes or runs", async () => {
  const r = tmpRoot("morph-p10c-");
  try {
    r.write("src/a.ts", "old\n");
    const out = await verifyCard({ root: r.root, targets: ["src/a.ts"], command: "touch ran; exit 1", env: ENV, variants: [
      { variant: "c.v1", answer: { corrupt: "missing section for src/a.ts" } },
      { variant: "c.v2", answer: { truncated: true } }] });
    expect(out.results.map((x) => x.log), "logs").toStrictEqual(["answer corrupt: missing section for src/a.ts", OLD_TEXT]);
    expect(r.exists("ran"), "the command ran").toBe(false);
    expect(r.read("src/a.ts"), "a").toBe("old\n");
  } finally {
    r.rm();
  }
});
