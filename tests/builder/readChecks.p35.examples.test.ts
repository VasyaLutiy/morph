import { test, expect } from "vitest";
import { validateChecks, DEFAULT_FROZEN } from "../../src/builder/readChecks.js";

test("Read Checks example 5: the cut form, and the empty cut", () => {
  expect(
    validateChecks({
      phase: "p35",
      fullExclude: ["tests/x.test.ts"],
      overrides: [
        { id: "a-judge", files: [{ file: "tests/a.examples.test.ts", lits: ["A example 1"] }] },
        { id: "b", extra: "echo b\n" },
      ],
    }),
  ).toStrictEqual({
    ok: true,
    checks: {
      version: 1,
      phase: "p35",
      parts: "decks/p35/parts",
      frozen: DEFAULT_FROZEN,
      fullExclude: ["tests/x.test.ts"],
      ownGit: false,
      cards: [],
      overrides: [
        {
          id: "a-judge",
          smoke: null,
          extra: null,
          files: [
            {
              file: "tests/a.examples.test.ts",
              min: null,
              max: null,
              lits: ["A example 1"],
              drop: null,
              new: null,
            },
          ],
        },
        { id: "b", smoke: null, extra: "echo b\n", files: null },
      ],
    },
  });

  expect(validateChecks({ phase: "p35" })).toStrictEqual({
    ok: true,
    checks: {
      version: 1,
      phase: "p35",
      parts: "decks/p35/parts",
      frozen: DEFAULT_FROZEN,
      fullExclude: [],
      ownGit: false,
      cards: [],
      overrides: [],
    },
  });
});

test("Read Checks example 6: the cut form's problems", () => {
  expect(
    validateChecks({ phase: "p35", cards: [{ id: "a" }], overrides: [] }),
  ).toStrictEqual({
    ok: false,
    problems: [
      "(root): cards and overrides exclude each other: cards lists every card, overrides only the cut's cards that differ",
    ],
  });

  expect(validateChecks({ phase: "p35", overrides: "x" })).toStrictEqual({
    ok: false,
    problems: ["overrides: must be a list"],
  });

  expect(
    validateChecks({
      phase: "p35",
      overrides: [
        3,
        { id: "a", files: [{ min: 4, max: 2 }] },
        { id: "a", smoke: 1, files: [{ file: "t.ts" }] },
      ],
    }),
  ).toStrictEqual({
    ok: false,
    problems: [
      "overrides[0]: must be an object",
      "overrides[1].files[0].file: required",
      "overrides[1].files[0]: min 4 exceeds max 2",
      "overrides[2].id: duplicate id 'a'",
      "overrides[2]: a judge card (files) takes no smoke or extra",
    ],
  });
});
