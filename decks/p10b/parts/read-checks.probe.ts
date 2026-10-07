// P10b probe for read-checks: src/builder/types.ts and validateChecks, DEFAULT_FROZEN by docs/TASK_P10b_builder.md
// §2.2, one test per record example (Component builder: Read Checks 1-4), then the §2.2 rows and the types.
import { test, expect, expectTypeOf } from "vitest";
import { DEFAULT_FROZEN, validateChecks } from "../../src/builder/readChecks.js";
import type {
  BuildInput, BuildResult, BuildTexts, CardContext, CheckCard, Checks, ChecksResult, JudgeFile,
} from "../../src/builder/types.js";
import type { Card } from "../../src/cards/types.js";
import type { LanguageProfile } from "../../src/language/types.js";
import { fixtureJson } from "../../tests/helpers.js";

test("Read Checks example 1: defaults filled", () => {
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

test("Read Checks example 2: the P10a checks document", () => {
  expect(validateChecks(fixtureJson("builder/p10.checks.json")))
    .toStrictEqual({ ok: true, checks: fixtureJson("builder/p10.checks.typed.json") });
});

test("Read Checks example 3: the bad document, 21 problems in order", () => {
  expect(validateChecks(fixtureJson("builder/badChecks.json")))
    .toStrictEqual({ ok: false, problems: fixtureJson("builder/badChecks.problems.json") });
});

test("Read Checks example 4: not an object; nothing required given", () => {
  for (const doc of [[], null, "x"]) {
    expect(validateChecks(doc)).toStrictEqual({ ok: false, problems: ["(root): checks must be an object"] });
  }
  expect(validateChecks({})).toStrictEqual({ ok: false, problems: ["phase: required", "cards: required"] });
});

test("§2.2 every key given, kept as given", () => {
  const doc = {
    version: 1, phase: "p7", parts: "decks/x/parts", frozen: ["docs"], fullExclude: ["tests/a.test.ts"], ownGit: true,
    cards: [
      { id: "m", smoke: 5, extra: "echo '== bin'\n" },
      { id: "m-judge", files: [{ file: "t/a.ts", min: 0, max: 0, lits: ["x"], drop: ["y"], new: true }] },
    ],
  };
  expect(validateChecks(doc)).toStrictEqual({
    ok: true,
    checks: {
      version: 1, phase: "p7", parts: "decks/x/parts", frozen: ["docs"], fullExclude: ["tests/a.test.ts"], ownGit: true,
      cards: [
        { id: "m", smoke: 5, extra: "echo '== bin'\n", files: null },
        { id: "m-judge", smoke: null, extra: null, files: [{ file: "t/a.ts", min: 0, max: 0, lits: ["x"], drop: ["y"], new: true }] },
      ],
    },
  });
});

test("§2.2 single problems: smoke, an empty card list, min over max, a missing min", () => {
  expect(validateChecks({ phase: "p", cards: [{ id: "a", smoke: 1.5 }] }))
    .toStrictEqual({ ok: false, problems: ["cards[0].smoke: must be a positive integer"] });
  expect(validateChecks({ phase: "p", cards: [] })).toStrictEqual({ ok: false, problems: ["cards: must be a non-empty list"] });
  expect(validateChecks({ phase: "p", cards: [{ id: "j", files: [{ file: "f", min: 5, max: 4 }] }] }))
    .toStrictEqual({ ok: false, problems: ["cards[0].files[0]: min 5 exceeds max 4"] });
  expect(validateChecks({ phase: "p", cards: [{ id: "j", files: [{ file: "f", max: 4 }] }] }))
    .toStrictEqual({ ok: false, problems: ["cards[0].files[0].min: required"] });
  expect(DEFAULT_FROZEN).toStrictEqual(["contour.yaml", "morph-map.json", "docs", "decks", "tests/fixtures"]);
});

test("§2.2 a judge card with an extra step", () => {
  expect(validateChecks({ phase: "p", cards: [{ id: "j", extra: "x", files: [{ file: "f", min: 0, max: 0 }] }] }))
    .toStrictEqual({ ok: false, problems: ["cards[0]: a judge card (files) takes no smoke or extra"] });
});

test("§2.2 types", () => {
  expectTypeOf(validateChecks).toEqualTypeOf<(doc: unknown) => ChecksResult>();
  expectTypeOf<JudgeFile>().toEqualTypeOf<{ file: string; min: number; max: number; lits: string[]; drop: string[]; new: boolean }>();
  expectTypeOf<CheckCard>().toEqualTypeOf<{ id: string; smoke: number | null; extra: string | null; files: JudgeFile[] | null }>();
  expectTypeOf<Checks>().toEqualTypeOf<{
    version: 1; phase: string; parts: string; frozen: string[]; fullExclude: string[]; ownGit: boolean; cards: CheckCard[];
  }>();
  expectTypeOf<ChecksResult>().toEqualTypeOf<{ ok: true; checks: Checks } | { ok: false; problems: string[] }>();
  expectTypeOf<CardContext>().toEqualTypeOf<{
    id: string; phase: string; targets: string[]; siblings: string[]; frozen: string[]; fullExclude: string[];
    ownGit: boolean; profile: LanguageProfile; guard: string; firstdiff: string;
  }>();
  expectTypeOf<BuildTexts>().toEqualTypeOf<{ guard: string; firstdiff: string; probes: Record<string, string> }>();
  expectTypeOf<BuildInput>().toEqualTypeOf<{ cards: Card[]; checks: Checks; profile: LanguageProfile; texts: BuildTexts }>();
  expectTypeOf<BuildResult>().toEqualTypeOf<{ ok: true; cards: Card[] } | { ok: false; errors: string[] }>();
});
