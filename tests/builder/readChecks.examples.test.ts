import { test, expect } from "vitest";
import { validateChecks } from "../../src/builder/readChecks.js";
import { fixtureJson } from "../helpers.js";

test("Read Checks example 1: minimal phase with defaults", () => {
  const r = validateChecks({
    phase: "p9",
    cards: [
      { id: "a" },
      { id: "a-judge", files: [{ file: "tests/a.examples.test.ts", min: 1, max: 9 }] },
    ],
  });
  expect(r).toStrictEqual({
    ok: true,
    checks: {
      version: 1,
      phase: "p9",
      parts: "decks/p9/parts",
      frozen: ["contour.yaml", "morph-map.json", "docs", "decks", "tests/fixtures"],
      fullExclude: [],
      ownGit: false,
      cards: [
        { id: "a", smoke: null, extra: null, files: null },
        {
          id: "a-judge",
          smoke: null,
          extra: null,
          files: [
            { file: "tests/a.examples.test.ts", min: 1, max: 9, lits: [], drop: [], new: false },
          ],
        },
      ],
    },
  });
});

test("Read Checks example 2: the P10a checks document", () => {
  const r = validateChecks(fixtureJson("builder/p10.checks.json"));
  expect(r).toStrictEqual({ ok: true, checks: fixtureJson("builder/p10.checks.typed.json") });
});

test("Read Checks example 3: the bad checks document, 21 problems", () => {
  const r = validateChecks(fixtureJson("builder/badChecks.json"));
  expect(r).toStrictEqual({ ok: false, problems: fixtureJson("builder/badChecks.problems.json") });
});

test("Read Checks example 4: not an object, and an empty object", () => {
  for (const doc of [[], null, "x"]) {
    expect(validateChecks(doc)).toStrictEqual({
      ok: false,
      problems: ["(root): checks must be an object"],
    });
  }
  expect(validateChecks({})).toStrictEqual({
    ok: false,
    problems: ["phase: required", "cards: required"],
  });
});

test("Read Checks own: a judge card takes no smoke or extra", () => {
  const r = validateChecks({
    phase: "p1",
    cards: [{ id: "a-judge", smoke: 1, extra: "x", files: [{ file: "t.ts", min: 1, max: 2 }] }],
  });
  expect(r).toStrictEqual({
    ok: false,
    problems: ["cards[0]: a judge card (files) takes no smoke or extra"],
  });
});

test("Read Checks own: min exceeds max", () => {
  const r = validateChecks({
    phase: "p1",
    cards: [{ id: "a-judge", files: [{ file: "t.ts", min: 5, max: 2 }] }],
  });
  expect(r).toStrictEqual({ ok: false, problems: ["cards[0].files[0]: min 5 exceeds max 2"] });
});

test("Read Checks own: duplicate card id", () => {
  const r = validateChecks({ phase: "p1", cards: [{ id: "a" }, { id: "a" }] });
  expect(r).toStrictEqual({ ok: false, problems: ["cards[1].id: duplicate id 'a'"] });
});
