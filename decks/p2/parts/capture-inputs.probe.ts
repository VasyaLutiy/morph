// P2 probe for capture-inputs: captureInputs and compareCaptures by docs/TASK_P2_compiler.md
// §2.2, one test per record example, values and types. Runs from probe/capture-inputs/ under
// vitest; example 2 rewrites a file under a tmpRoot().
import { test, expect } from "vitest";
import { createHash } from "node:crypto";
import { captureInputs, compareCaptures } from "../../src/compiler/capture.js";
import type { InputDigest } from "../../src/compiler/types.js";
import { validateCard } from "../../src/cards/model.js";
import type { Card } from "../../src/cards/types.js";
import { fixtureJson, fixturePath, tmpRoot } from "../../tests/helpers.js";

function card(input: unknown): Card {
  const r = validateCard(input);
  if (!r.ok) throw new Error("fixture card invalid: " + r.faults.map((f) => f.message).join("; "));
  return r.card;
}
const sha16 = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 16);

test("Capture Inputs example 1: src/x.ts = 'a\\n' and an absent tests/x.test.ts", () => {
  const d: InputDigest = captureInputs(card(fixtureJson("compiler/cards/digest.json")), fixturePath("compiler/digest"));
  expect(JSON.stringify(d), "the record's literal, keys sorted")
    .toBe('{"src/x.ts":"87428fc522803d31","tests/x.test.ts":"absent"}');
  const v: string = d["src/x.ts"] ?? "";
  expect(v.length, "16 hex chars").toBe(16);
});

test("Capture Inputs example 2: a capture, then src/x.ts rewritten", () => {
  const r = tmpRoot();
  try {
    r.write("src/x.ts", "a\n");
    const c = card({ customId: "d", intent: "generate", targets: ["tests/x.test.ts"], contextSlice: ["src/x.ts"], instruction: "x" });
    const before = captureInputs(c, r.root);
    r.write("src/x.ts", "b\n");
    const after = captureInputs(c, r.root);
    const changed: string[] = compareCaptures(before, after);
    expect(JSON.stringify(changed), "changed is ['src/x.ts']").toBe('["src/x.ts"]');
    expect(JSON.stringify(compareCaptures(before, before)), "equal captures").toBe("[]");
  } finally {
    r.rm();
  }
});

test("Capture Inputs §2.2: sorted distinct paths, directories are absent, 16 hex of sha256, keys on one side", () => {
  const r = tmpRoot();
  try {
    r.write("src/b.ts", "hello\n");
    r.write("src/a.ts", "");
    r.write("docs/d/keep", "k");
    const c = card({ customId: "c", intent: "patch", targets: ["src/b.ts", "src/a.ts"], contextSlice: ["src/b.ts", "docs/d", "zzz.md"], instruction: "x" });
    const d = captureInputs(c, r.root);
    expect(Object.keys(d).join(","), "sorted, distinct").toBe("docs/d,src/a.ts,src/b.ts,zzz.md");
    expect(`${d["docs/d"]} ${d["zzz.md"]}`, "directory and missing are absent").toBe("absent absent");
    expect(`${d["src/b.ts"]} ${d["src/a.ts"]}`, "sha256 prefixes").toBe(`${sha16("hello\n")} ${sha16("")}`);
    expect(JSON.stringify(compareCaptures({ "a.ts": "x" }, { "b.ts": "x" })), "a key on one side only is changed").toBe('["a.ts","b.ts"]');
    expect(JSON.stringify(compareCaptures({ "a.ts": "absent" }, { "a.ts": "absent" })), "absent on both sides is unchanged").toBe("[]");
  } finally {
    r.rm();
  }
});
