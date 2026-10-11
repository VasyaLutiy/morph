// P35a probe for default-checks by docs/TASK_P35a_criterion.md §2.2 (src/criterion/defaultChecks.ts) — issue #45:
// the cut form's cards, judge bounds and fullExclude from the cut and the record; the name check of both forms.
// A new file: every row red on the stub.
import { test, expect } from "vitest";
import { defaultChecks, thenLiterals } from "../../src/criterion/defaultChecks.js";
import { DEFAULT_FROZEN, validateChecks } from "../../src/builder/readChecks.js";
import { GO, TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";
import type { Card } from "../../src/cards/types.js";
import type { CheckOverride, Checks } from "../../src/builder/types.js";
import type { CardCriterion } from "../../src/planner/types.js";
import type { DefaultChecksInput } from "../../src/criterion/defaultChecks.js";

const FR = ["contour.yaml", "morph-map.json", "decks", "go.mod", "internal"];
const C = (over: Partial<Checks> = {}): Checks => ({
  version: 1, phase: "m1", parts: "decks/m1/parts", frozen: FR, fullExclude: [], ownGit: false, cards: [], overrides: [], ...over,
});
const cards = (): Card[] => fixtureJson("cli/goMini.deck.json") as Card[];
const ids = (): string[] => cards().map((c) => c.customId);
const goProbe = (id: string): string => fixture("go-mini/decks/m1/parts/_" + id + "_probe_test.go");
const input = (checks: Checks, over: Partial<DefaultChecksInput> = {}): DefaultChecksInput => ({
  checks, cards: cards(), all: ids(),
  criteria: fixtureJson("criterion/goMini.criteria.json") as Record<string, CardCriterion>,
  profile: GO, mapAcceptance: [], hasFile: () => false,
  record: [{ name: "Clamp Value", count: 4 }, { name: "Percent Of", count: 5 }, { name: "Format Share", count: 3 }],
  probes: {}, readProbe: goProbe, ...over,
});
const JF = ["calc/clamp_value_examples_test.go", "calc/percent_of_examples_test.go", "report/format_share_examples_test.go"];
const CARDS1 = [
  { id: "clamp-value", smoke: null, extra: null, files: null },
  { id: "clamp-value-judge", smoke: null, extra: null, files: [{ file: JF[0], min: 4, max: 10, lits: [], drop: [], new: true }] },
  { id: "percent-of", smoke: null, extra: null, files: null },
  { id: "format-share", smoke: null, extra: null, files: null },
  { id: "percent-of-judge", smoke: null, extra: null, files: [{ file: JF[1], min: 5, max: 11, lits: [], drop: [], new: true }] },
  { id: "format-share-judge", smoke: null, extra: null, files: [{ file: JF[2], min: 3, max: 9,
    lits: ["cpu: 33% (1 of 3)", "total: 100% (5 of 4)", "disk: 0% (0 of 0)"], drop: [], new: true }] },
];
const PROBES = { "clamp-value": goProbe("clamp-value"), "percent-of": goProbe("percent-of"), "format-share": goProbe("format-share") };
const N = (o: Partial<CheckOverride> & { id: string }): CheckOverride => ({ smoke: null, extra: null, files: null, ...o });
const F = (file: string, o: Record<string, unknown> = {}) =>
  ({ file, min: null, max: null, lits: null, drop: null, new: null, ...o }) as NonNullable<CheckOverride["files"]>[number];

test("Default Checks example 1: the cut form's defaults on go-mini", () => {
  expect(defaultChecks(input(C()))).toStrictEqual({
    ok: true, checks: C({ cards: CARDS1, fullExclude: JF }), probes: PROBES, overrides: [],
  });
});

test("Default Checks example 2: overrides win and are listed", () => {
  const O2 = [
    N({ id: "percent-of-judge", files: [F(JF[1], { max: 7, lits: ["TestPercentOfExample1"], new: false })] }),
    N({ id: "clamp-value", extra: "echo hi\n" }),
    N({ id: "dropped-card" }),
  ];
  const want = CARDS1.map((c) => {
    if (c.id === "clamp-value") return { ...c, extra: "echo hi\n" };
    if (c.id === "percent-of-judge") {
      return { ...c, files: [{ file: JF[1], min: 5, max: 7, lits: ["TestPercentOfExample1"], drop: [], new: false }] };
    }
    return c;
  });
  expect(defaultChecks(input(C({ fullExclude: ["internal"], overrides: O2 }), { all: [...ids(), "dropped-card"] }))).toStrictEqual({
    ok: true,
    checks: C({ fullExclude: ["internal", ...JF], overrides: O2, cards: want }),
    probes: PROBES,
    overrides: ["percent-of-judge: max from checks.json", "percent-of-judge: lits from checks.json"],
  });
});

test("Default Checks example 3: the errors, then a drifted probe", () => {
  const O3 = [
    N({ id: "nope" }),
    N({ id: "clamp-value", files: [F(JF[0], { min: 1 })] }),
    N({ id: "clamp-value-judge", files: [F(JF[0], { max: 2 })] }),
    N({ id: "percent-of-judge", smoke: 3 }),
    N({ id: "format-share-judge", files: [F("report/other_test.go")] }),
  ];
  expect(defaultChecks(input(C({ overrides: O3 })))).toStrictEqual({
    ok: false,
    message:
      "checks defaults not built (5 errors):\n" +
      "checks override 'nope' is not a card of the cut\n" +
      "checks override 'clamp-value': files given for a code card\n" +
      "judge 'clamp-value-judge' calc/clamp_value_examples_test.go: min 4 exceeds max 2\n" +
      "checks override 'percent-of-judge': smoke or extra given for a judge\n" +
      "checks override 'format-share-judge': report/other_test.go is not a target of the judge",
  });
  const drift = (id: string): string => (id === "clamp-value" ? fixture("cli/clampValue.drift.probe.txt") : goProbe(id));
  expect(defaultChecks(input(C(), { readProbe: drift }))).toStrictEqual({
    ok: false,
    message:
      "probe names differ from the record (2 problems):\n" +
      "card 'clamp-value': probe decks/m1/parts/_clamp-value_probe_test.go lacks Clamp Value example 4 (the record gives 4)\n" +
      "card 'clamp-value': probe decks/m1/parts/_clamp-value_probe_test.go names Clamp Value example 5, not an example of its Functions (Clamp Value)",
  });
});

test("Default Checks example 4: the old form untouched, several judge files, skipped cards", () => {
  const old = validateChecks(fixtureJson("go-mini/decks/m1/checks.json"));
  if (!old.ok) throw new Error(old.problems.join("; "));
  const short = { "clamp-value": fixture("cli/clampValue.short.probe.txt") };
  expect(defaultChecks(input(old.checks, { probes: short, readProbe: () => null }))).toStrictEqual({
    ok: true, checks: old.checks, probes: short, overrides: [],
  });
  const ts = fixtureJson("criterion/ts.input.json") as { cards: Card[]; criteria: Record<string, CardCriterion> };
  const T = (over: Partial<Checks> = {}): Checks => ({
    version: 1, phase: "t", parts: "decks/t/parts", frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false, cards: [], overrides: [], ...over,
  });
  const AB = 'test("A B example 1: one", () => {});\n';
  const tsInput = (checks: Checks): DefaultChecksInput => ({
    checks, cards: ts.cards, all: ts.cards.map((c) => c.customId), criteria: ts.criteria, profile: TYPESCRIPT,
    mapAcceptance: ["ef"], hasFile: () => false, record: [{ name: "A B", count: 1 }], probes: {},
    readProbe: (id) => (id === "ab" ? AB : id === "cd" ? "// cd\n" : null),
  });
  expect(defaultChecks(tsInput(T()))).toStrictEqual({
    ok: false,
    message:
      "checks defaults not built (2 errors):\n" +
      "judge 'ab-judge' writes 2 test files: give min and max of tests/a.examples.test.ts in checks.json overrides\n" +
      "judge 'ab-judge' writes 2 test files: give min and max of tests/b.examples.test.ts in checks.json overrides",
  });
  const OT = [N({ id: "ab-judge", files: [F("tests/a.examples.test.ts", { min: 1, max: 3 }), F("tests/b.examples.test.ts", { min: 2, max: 2, lits: ["y"] })] })];
  expect(defaultChecks(tsInput(T({ overrides: OT })))).toStrictEqual({
    ok: true,
    checks: T({
      overrides: OT,
      fullExclude: ["tests/a.examples.test.ts", "tests/b.examples.test.ts"],
      cards: [
        { id: "ab", smoke: null, extra: null, files: null },
        { id: "ab-judge", smoke: null, extra: null, files: [
          { file: "tests/a.examples.test.ts", min: 1, max: 3, lits: [], drop: [], new: true },
          { file: "tests/b.examples.test.ts", min: 2, max: 2, lits: ["y"], drop: [], new: true },
        ] },
        { id: "cd", smoke: 5, extra: null, files: null },
      ],
    }),
    probes: { ab: AB, cd: "// cd\n" },
    overrides: [
      "ab-judge tests/a.examples.test.ts: min from checks.json",
      "ab-judge tests/a.examples.test.ts: max from checks.json",
      "ab-judge tests/b.examples.test.ts: min from checks.json",
      "ab-judge tests/b.examples.test.ts: max from checks.json",
      "ab-judge tests/b.examples.test.ts: lits from checks.json",
    ],
  });
});

test("Default Checks example 5: thenLiterals", () => {
  const ex = (then: string) => ({ given: "g", when: "w", then, ref: null });
  expect(thenLiterals([ex('"a b"  and "c\\"d"'), ex("none"), ex('"a  b" "  x   y  " "" "open')])).toStrictEqual([
    "a b", 'c\\"d', "x y",
  ]);
});
