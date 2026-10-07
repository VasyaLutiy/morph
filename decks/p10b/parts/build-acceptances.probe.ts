// P10b probe for build-acceptances: HEREDOC_TAGS and buildAcceptances by docs/TASK_P10b_builder.md §2.2, one test per
// record example (Component builder: Build Acceptances 1-4), then the §2.2 rows and the types. Example 1 is the golden
// check: the P10a deck's 12 acceptances, as build.py p10 wrote them, byte for byte.
import { test, expect, expectTypeOf } from "vitest";
import { HEREDOC_TAGS, buildAcceptances } from "../../src/builder/buildAcceptances.js";
import { codeAcceptance } from "../../src/builder/compose.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import type { BuildInput, BuildResult, CardContext, Checks } from "../../src/builder/types.js";
import { loadDeck } from "../../src/cards/model.js";
import type { Card } from "../../src/cards/types.js";
import { PYTHON, TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture, fixtureJson } from "../../tests/helpers.js";

// the heredoc tags are spelled in two pieces: build.py refuses a probe whose text holds one
const M = (t: string): string => "MORPH" + "_" + t + "_EOF";

function deck(name: string): Card[] {
  const d = loadDeck(fixture(name));
  if (!d.ok) throw new Error(JSON.stringify(d.faults));
  return d.deck.cards;
}
const card = (id: string, targets: string[], dependsOn: string[] = []): Card => ({
  customId: id, intent: "patch", targets, contextSlice: [], instruction: "x", acceptance: null, model: null,
  maxTokens: null, reasoning: null, variants: 1, dependsOn,
});
const checks = (cards: Checks["cards"]): Checks => ({
  version: 1, phase: "p1", parts: "decks/p1/parts", frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false, cards,
});
const code = (id: string): Checks["cards"][number] => ({ id, smoke: null, extra: null, files: null });
const ctx = (id: string, targets: string[], siblings: string[]): CardContext => ({
  id, phase: "p1", targets, siblings, frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false, profile: TYPESCRIPT,
  guard: "// guard\n", firstdiff: "// firstdiff\n",
});

test("Build Acceptances example 1: the P10a deck, byte for byte (golden)", () => {
  const golden = deck("../../decks/p10/v2deck.json");
  const probes: Record<string, string> = {};
  for (const id of ["parse-command", "render", "cut-component", "cut-judges", "plan-spec", "plan-command"]) {
    probes[id] = fixture("../../decks/p10/parts/" + id + ".probe.ts");
  }
  const r = buildAcceptances({
    cards: golden.map((c) => ({ ...c, acceptance: null })), checks: fixtureJson("builder/p10.checks.typed.json") as Checks,
    profile: TYPESCRIPT, texts: { guard: fixture("builder/guard.p10.txt"), firstdiff: fixture("builder/firstdiff.p10.txt"), probes },
  });
  const got = r.ok ? r.cards : [];
  for (let i = 0; i < golden.length; i++) expect(got[i]?.acceptance, golden[i].customId).toBe(golden[i].acceptance);
  expect(r).toStrictEqual({ ok: true, cards: golden });
});

test("Build Acceptances example 2: siblings within a generation of the members only", () => {
  const cards = [card("a", ["src/x/a.ts"]), card("b", ["src/x/b.ts"]), card("c", ["src/x/c.ts"]), card("d", ["src/x/d.ts"], ["a"])];
  const r = buildAcceptances({
    cards, checks: checks([code("b"), code("a"), code("d")]), profile: TYPESCRIPT,
    texts: { guard: "// guard\n", firstdiff: "// firstdiff\n", probes: { a: "// probe\n", b: "// probe\n", d: "// probe\n" } },
  });
  const p = "// probe\n";
  expect(r).toStrictEqual({
    ok: true,
    cards: [
      { ...cards[0], acceptance: codeAcceptance(ctx("a", ["src/x/a.ts"], ["src/x/b.ts"]), p, null, null) },
      { ...cards[1], acceptance: codeAcceptance(ctx("b", ["src/x/b.ts"], ["src/x/a.ts"]), p, null, null) },
      cards[2],
      { ...cards[3], acceptance: codeAcceptance(ctx("d", ["src/x/d.ts"], []), p, null, null) },
    ],
  });
});

test("Build Acceptances example 3: every error, in order", () => {
  const r = buildAcceptances({
    cards: [card("a", ["src/x/a.ts", "tests/x/a.test.ts"]), card("j", ["tests/x/j.examples.test.ts"])],
    checks: checks([code("a"), { id: "j", smoke: null, extra: null, files: [{ file: "tests/x/k.examples.test.ts", min: 1, max: 2, lits: [], drop: [], new: true }] }, code("z")]),
    profile: TYPESCRIPT, texts: { guard: ("x " + M("PROBE")), firstdiff: "", probes: {} },
  });
  expect(r).toStrictEqual({
    ok: false,
    errors: [
      ("the guard holds the heredoc tag " + M("PROBE")),
      "code card 'a' has no probe",
      "code card 'a' targets the test tests/x/a.test.ts but has no smoke cap",
      'judge \'j\': files ["tests/x/k.examples.test.ts"] are not its targets ["tests/x/j.examples.test.ts"]',
      "checks card 'z' is not in the deck",
    ],
  });
});

test("Build Acceptances example 4: only typescript has a builder", () => {
  expect(buildAcceptances({ cards: [], checks: checks([code("a")]), profile: PYTHON, texts: { guard: "", firstdiff: "", probes: {} } }))
    .toStrictEqual({ ok: false, errors: ["no acceptance builder for language 'python' (only typescript)"] });
});

test("§2.2 HEREDOC_TAGS; a probe or the locator holding a tag; a smoke cap without a test", () => {
  expect(HEREDOC_TAGS).toStrictEqual([M("GUARD"), M("CONF"), M("TSCONF"), M("FIRSTDIFF"),
    M("PROBE"), M("LITS")]);
  const r = buildAcceptances({
    cards: [card("a", ["src/x/a.ts"])], checks: checks([{ id: "a", smoke: 5, extra: null, files: null }]), profile: TYPESCRIPT,
    texts: { guard: "", firstdiff: (M("LITS") + " " + M("CONF")), probes: { a: M("GUARD") } },
  });
  expect(r).toStrictEqual({
    ok: false,
    errors: [
      ("the first-difference locator holds the heredoc tag " + M("CONF")),
      ("the first-difference locator holds the heredoc tag " + M("LITS")),
      ("the probe of a holds the heredoc tag " + M("GUARD")),
      "code card 'a' has a smoke cap but no test target",
    ],
  });
});

test("§2.2 the input cards are not changed", () => {
  const cards = [card("a", ["src/x/a.ts"])];
  const r = buildAcceptances({ cards, checks: checks([code("a")]), profile: TYPESCRIPT,
    texts: { guard: "g", firstdiff: "f", probes: { a: "p" } } });
  expect(cards[0].acceptance).toBe(null);
  expect(r.ok && r.cards[0] !== cards[0]).toBe(true);
});

test("§2.2 types", () => {
  expectTypeOf(buildAcceptances).toEqualTypeOf<(input: BuildInput) => BuildResult>();
  expectTypeOf(HEREDOC_TAGS).toEqualTypeOf<readonly string[]>();
});
