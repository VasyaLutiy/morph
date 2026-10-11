// P35a probe for read-checks by docs/TASK_P35a_criterion.md §2.2 (src/builder/types.ts, src/builder/readChecks.ts) —
// issue #45: the cut form (no cards, overrides). Starts from P10b's probe: changed Read Checks 3 (the root table ends
// with overrides) and 4 ({} needs only phase); new 5 and 6. Unchanged rows: Read Checks 1, 2 and an old-form card
// keeping every key (green on the stub, the current file).
import { test, expect } from "vitest";
import { DEFAULT_FROZEN, validateChecks } from "../../src/builder/readChecks.js";
import { fixtureJson } from "../../tests/helpers.js";
import type { CheckOverride, Checks, OverrideFile } from "../../src/builder/types.js";

test("Read Checks example 1: defaults filled (unchanged)", () => {
  expect(validateChecks({ phase: "p9", cards: [{ id: "a" }, { id: "a-judge", files: [{ file: "tests/a.examples.test.ts", min: 1, max: 9 }] }] }))
    .toStrictEqual({
      ok: true,
      checks: {
        version: 1, phase: "p9", parts: "decks/p9/parts",
        frozen: ["contour.yaml", "morph-map.json", "docs", "decks", "tests/fixtures"], fullExclude: [], ownGit: false,
        cards: [
          { id: "a", smoke: null, extra: null, files: null },
          { id: "a-judge", smoke: null, extra: null, files: [{ file: "tests/a.examples.test.ts", min: 1, max: 9, lits: [], drop: [], new: false }] },
        ],
      },
    });
});

test("Read Checks example 2: the P10a checks document (unchanged)", () => {
  expect(validateChecks(fixtureJson("builder/p10.checks.json")))
    .toStrictEqual({ ok: true, checks: fixtureJson("builder/p10.checks.typed.json") });
});

test("Read Checks example 3: the bad document, 21 problems, the root table ends with overrides", () => {
  const r = validateChecks(fixtureJson("builder/badChecks.json"));
  expect(r).toStrictEqual({ ok: false, problems: fixtureJson("builder/badChecks.problems.json") });
  if (r.ok) throw new Error("ok");
  expect(r.problems[0]).toBe(
    "(root): unknown key 'extra' (known: version, phase, parts, frozen, fullExclude, ownGit, cards, overrides)",
  );
});

test("Read Checks example 4: not an object (unchanged); {} needs only phase", () => {
  for (const doc of [[], null, "x"]) {
    expect(validateChecks(doc)).toStrictEqual({ ok: false, problems: ["(root): checks must be an object"] });
  }
  expect(validateChecks({})).toStrictEqual({ ok: false, problems: ["phase: required"] });
});

test("Read Checks example 5: the cut form typed, overrides last", () => {
  const file: OverrideFile = { file: "tests/a.examples.test.ts", min: null, max: null, lits: ["A example 1"], drop: null, new: null };
  const overrides: CheckOverride[] = [
    { id: "a-judge", smoke: null, extra: null, files: [file] },
    { id: "b", smoke: null, extra: "echo b\n", files: null },
  ];
  const want: Checks = {
    version: 1, phase: "p35", parts: "decks/p35/parts", frozen: DEFAULT_FROZEN, fullExclude: ["tests/x.test.ts"],
    ownGit: false, cards: [], overrides,
  };
  const r = validateChecks({
    phase: "p35", fullExclude: ["tests/x.test.ts"],
    overrides: [{ id: "a-judge", files: [{ file: "tests/a.examples.test.ts", lits: ["A example 1"] }] }, { id: "b", extra: "echo b\n" }],
  });
  expect(r).toStrictEqual({ ok: true, checks: want });
  if (!r.ok) throw new Error(r.problems.join("; "));
  expect(Object.keys(r.checks)).toStrictEqual(["version", "phase", "parts", "frozen", "fullExclude", "ownGit", "cards", "overrides"]);
  expect(validateChecks({ phase: "p35" })).toStrictEqual({
    ok: true,
    checks: { version: 1, phase: "p35", parts: "decks/p35/parts", frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false, cards: [], overrides: [] },
  });
});

test("Read Checks example 6: the cut form's problems", () => {
  expect(validateChecks({ phase: "p35", cards: [{ id: "a" }], overrides: [] })).toStrictEqual({
    ok: false,
    problems: ["(root): cards and overrides exclude each other: cards lists every card, overrides only the cut's cards that differ"],
  });
  expect(validateChecks({ phase: "p35", overrides: "x" })).toStrictEqual({ ok: false, problems: ["overrides: must be a list"] });
  expect(
    validateChecks({ phase: "p35", overrides: [3, { id: "a", files: [{ min: 4, max: 2 }] }, { id: "a", smoke: 1, files: [{ file: "t.ts" }] }] }),
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

test("an old-form card keeps every key and gets no overrides key (unchanged)", () => {
  const r = validateChecks({ phase: "p7", cards: [{ id: "m", smoke: 5, extra: "echo x\n" }] });
  expect(r).toStrictEqual({
    ok: true,
    checks: {
      version: 1, phase: "p7", parts: "decks/p7/parts", frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false,
      cards: [{ id: "m", smoke: 5, extra: "echo x\n", files: null }],
    },
  });
});
