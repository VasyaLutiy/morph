import { expect, test } from "vitest";
import { validateCard } from "../../src/cards/model.js";
import { captureInputs, compareCaptures } from "../../src/compiler/capture.js";
import type { Card } from "../../src/cards/types.js";
import { fixtureJson, tmpRoot } from "../helpers.js";

function digestCard(): Card {
  const result = validateCard(fixtureJson("compiler/cards/digest.json"));
  if (!result.ok) {
    throw new Error(`digest.json does not validate: ${result.faults[0]?.message ?? "faults"}`);
  }
  return result.card;
}

test("Capture Inputs example 1: src/x.ts digested, tests/x.test.ts absent", () => {
  const card = digestCard();
  const r = tmpRoot();
  try {
    r.write("src/x.ts", "a\n");
    const digest = captureInputs(card, r.root);
    expect(JSON.stringify(digest)).toBe(
      '{"src/x.ts":"87428fc522803d31","tests/x.test.ts":"absent"}',
    );
  } finally {
    r.rm();
  }
});

test("Capture Inputs example 2: rewritten src/x.ts is the only changed path", () => {
  const card = digestCard();
  const r = tmpRoot();
  try {
    r.write("src/x.ts", "a\n");
    const before = captureInputs(card, r.root);
    r.write("src/x.ts", "b\n");
    const after = captureInputs(card, r.root);
    expect(JSON.stringify(compareCaptures(before, after))).toBe('["src/x.ts"]');
  } finally {
    r.rm();
  }
});

test("compareCaptures: equal captures yield no changed paths", () => {
  const card = digestCard();
  const r = tmpRoot();
  try {
    r.write("src/x.ts", "a\n");
    const first = captureInputs(card, r.root);
    const second = captureInputs(card, r.root);
    expect(JSON.stringify(compareCaptures(first, second))).toBe("[]");
  } finally {
    r.rm();
  }
});

test("compareCaptures: a key present on one side only is changed", () => {
  const before: Record<string, string> = {};
  const after: Record<string, string> = { "src/x.ts": "87428fc522803d31" };
  expect(JSON.stringify(compareCaptures(before, after))).toBe('["src/x.ts"]');
});
