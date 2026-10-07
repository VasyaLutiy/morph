import { test, expect } from "vitest";
import { fixture, fixtureJson } from "../helpers.js";
import { buildAcceptances } from "../../src/builder/buildAcceptances.js";
import { codeAcceptance } from "../../src/builder/compose.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { TYPESCRIPT, PYTHON } from "../../src/language/profiles.js";
import { loadDeck } from "../../src/cards/model.js";
import type { CardContext, Checks } from "../../src/builder/types.js";
import type { Card } from "../../src/cards/types.js";

const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "a", phase: "p1", targets: ["src/x/a.ts"], siblings: [], frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false,
  profile: TYPESCRIPT, guard: "// guard\n", firstdiff: "// firstdiff\n", ...over,
});
const card = (id: string, targets: string[], dependsOn: string[] = []): Card => ({
  customId: id, intent: "patch", targets, contextSlice: [], instruction: "x", acceptance: null, model: null,
  maxTokens: null, reasoning: null, variants: 1, dependsOn,
});
const checks = (cards: Checks["cards"]): Checks => ({
  version: 1, phase: "p1", parts: "decks/p1/parts", frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false, cards,
});

const PROBE_IDS = ["parse-command", "render", "cut-component", "cut-judges", "plan-spec", "plan-command"];

test("Build Acceptances example 1: the P10a golden check, 12 acceptances byte for byte", () => {
  const d = loadDeck(fixture("../../decks/p10/v2deck.json"));
  if (!d.ok) throw new Error("the P10a deck file does not load");
  const inputCards: Card[] = d.deck.cards.map((c) => ({ ...c, acceptance: null }));
  const probes: Record<string, string> = {};
  for (const id of PROBE_IDS) {
    probes[id] = fixture("../../decks/p10/parts/" + id + ".probe.ts");
  }
  const r = buildAcceptances({
    cards: inputCards,
    checks: fixtureJson("builder/p10.checks.typed.json") as Checks,
    profile: TYPESCRIPT,
    texts: {
      guard: fixture("builder/guard.p10.txt"),
      firstdiff: fixture("builder/firstdiff.p10.txt"),
      probes,
    },
  });
  expect(r).toStrictEqual({ ok: true, cards: d.deck.cards });
});

test("Build Acceptances example 2: siblings by generation, a non-member untouched", () => {
  const r = buildAcceptances({
    cards: [card("a", ["src/x/a.ts"]), card("b", ["src/x/b.ts"]), card("c", ["src/x/c.ts"]), card("d", ["src/x/d.ts"], ["a"])],
    checks: checks([
      { id: "b", smoke: null, extra: null, files: null },
      { id: "a", smoke: null, extra: null, files: null },
      { id: "d", smoke: null, extra: null, files: null },
    ]),
    profile: TYPESCRIPT,
    texts: { guard: "// guard\n", firstdiff: "// firstdiff\n", probes: { a: "// probe\n", b: "// probe\n", d: "// probe\n" } },
  });
  if (!r.ok) throw new Error("expected ok");
  const byId = new Map(r.cards.map((c) => [c.customId, c]));
  expect(byId.get("a")?.acceptance).toBe(codeAcceptance(ctx({ targets: ["src/x/a.ts"], siblings: ["src/x/b.ts"] }), "// probe\n", null, null));
  expect(byId.get("b")?.acceptance).toBe(codeAcceptance(ctx({ id: "b", targets: ["src/x/b.ts"], siblings: ["src/x/a.ts"] }), "// probe\n", null, null));
  expect(byId.get("d")?.acceptance).toBe(codeAcceptance(ctx({ id: "d", targets: ["src/x/d.ts"], siblings: [] }), "// probe\n", null, null));
  expect(byId.get("c")?.acceptance).toBe(null);
});

test("Build Acceptances example 3: every error, in order", () => {
  const r = buildAcceptances({
    cards: [card("a", ["src/x/a.ts", "tests/x/a.test.ts"]), card("j", ["tests/x/j.examples.test.ts"])],
    checks: checks([
      { id: "a", smoke: null, extra: null, files: null },
      { id: "j", smoke: null, extra: null, files: [{ file: "tests/x/k.examples.test.ts", min: 1, max: 9, lits: [], drop: [], new: true }] },
      { id: "z", smoke: null, extra: null, files: null },
    ]),
    profile: TYPESCRIPT,
    texts: { guard: "x MORPH_PROBE_EOF", firstdiff: "// firstdiff\n", probes: {} },
  });
  expect(r).toStrictEqual({
    ok: false,
    errors: [
      "the guard holds the heredoc tag MORPH_PROBE_EOF",
      "code card 'a' has no probe",
      "code card 'a' targets the test tests/x/a.test.ts but has no smoke cap",
      "judge 'j': files [\"tests/x/k.examples.test.ts\"] are not its targets [\"tests/x/j.examples.test.ts\"]",
      "checks card 'z' is not in the deck",
    ],
  });
});

test("Build Acceptances example 4: python is refused", () => {
  const r = buildAcceptances({
    cards: [card("a", ["src/x/a.ts"])],
    checks: checks([{ id: "a", smoke: null, extra: null, files: null }]),
    profile: PYTHON,
    texts: { guard: "// guard\n", firstdiff: "// firstdiff\n", probes: { a: "// probe\n" } },
  });
  expect(r).toStrictEqual({ ok: false, errors: ["no acceptance builder for language 'python' (only typescript)"] });
});

test("Build Acceptances own 1: a heredoc tag in the first-difference locator", () => {
  const r = buildAcceptances({
    cards: [card("a", ["src/x/a.ts"])],
    checks: checks([{ id: "a", smoke: null, extra: null, files: null }]),
    profile: TYPESCRIPT,
    texts: { guard: "// guard\n", firstdiff: "x MORPH_LITS_EOF", probes: { a: "// probe\n" } },
  });
  expect(r).toStrictEqual({ ok: false, errors: ["the first-difference locator holds the heredoc tag MORPH_LITS_EOF"] });
});

test("Build Acceptances own 2: a smoke cap without a test target", () => {
  const r = buildAcceptances({
    cards: [card("a", ["src/x/a.ts"])],
    checks: checks([{ id: "a", smoke: 3, extra: null, files: null }]),
    profile: TYPESCRIPT,
    texts: { guard: "// guard\n", firstdiff: "// firstdiff\n", probes: { a: "// probe\n" } },
  });
  expect(r).toStrictEqual({ ok: false, errors: ["code card 'a' has a smoke cap but no test target"] });
});
