import { test, expect } from "vitest";
import { captureInputs, compareCaptures } from "../../src/compiler/capture.js";
import { validateCard } from "../../src/cards/model.js";
import { fixtureJson, tmpRoot } from "../helpers.js";

function digestCard() {
  const r = validateCard(fixtureJson("compiler/cards/digest.json"));
  if (!r.ok) expect.unreachable("digest card must be valid");
  return r.card;
}

test("Capture Inputs example 1", () => {
  const r = tmpRoot();
  try {
    const card = digestCard();
    r.write("src/x.ts", "a\n");
    const digest = captureInputs(card, r.root);
    expect(JSON.stringify(digest)).toBe('{"src/x.ts":"87428fc522803d31","tests/x.test.ts":"absent"}');
  } finally {
    r.rm();
  }
});

test("Capture Inputs example 2", () => {
  const r = tmpRoot();
  try {
    const card = digestCard();
    r.write("src/x.ts", "a\n");
    const before = captureInputs(card, r.root);
    r.write("src/x.ts", "b\n");
    const after = captureInputs(card, r.root);
    const changed = compareCaptures(before, after);
    expect(JSON.stringify(changed)).toBe('["src/x.ts"]');
  } finally {
    r.rm();
  }
});

test("keys are sorted across targets and contextSlice", () => {
  const r = tmpRoot();
  try {
    const card = digestCard();
    r.write("src/x.ts", "a\n");
    const digest = captureInputs(card, r.root);
    expect(Object.keys(digest)).toEqual(["src/x.ts", "tests/x.test.ts"]);
  } finally {
    r.rm();
  }
});

test("a directory in the slice is absent", () => {
  const r = tmpRoot();
  try {
    r.write("docs/keep/.keep", "");
    const base = validateCard({
      customId: "c",
      intent: "generate",
      targets: ["src/out.ts"],
      contextSlice: ["docs"],
      instruction: "Write src/out.ts.",
    });
    if (!base.ok) expect.unreachable("card must be valid");
    const digest = captureInputs(base.card, r.root);
    expect(JSON.stringify(digest)).toBe('{"docs":"absent","src/out.ts":"absent"}');
  } finally {
    r.rm();
  }
});

test("a key present on one side only is changed", () => {
  const before = { "src/a.ts": "aaaa", "src/b.ts": "bbbb" };
  const after = { "src/b.ts": "bbbb", "src/c.ts": "cccc" };
  const changed = compareCaptures(before, after);
  expect(JSON.stringify(changed)).toBe('["src/a.ts","src/c.ts"]');
});

test("equal captures compare to the empty list", () => {
  const r = tmpRoot();
  try {
    const card = digestCard();
    r.write("src/x.ts", "a\n");
    const a = captureInputs(card, r.root);
    const b = captureInputs(card, r.root);
    expect(JSON.stringify(compareCaptures(a, b))).toBe("[]");
  } finally {
    r.rm();
  }
});

test("digest of empty content differs from absent", () => {
  const r = tmpRoot();
  try {
    const card = digestCard();
    r.write("src/x.ts", "");
    const digest = captureInputs(card, r.root);
    const d = digest["src/x.ts"] ?? "absent";
    expect(d).not.toBe("absent");
    expect(d.length).toBe(16);
    expect(digest["tests/x.test.ts"]).toBe("absent");
  } finally {
    r.rm();
  }
});
