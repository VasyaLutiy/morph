// P21 probe for build-acceptances by docs/TASK_P21a_breaking.md §2.2 (src/builder/types.ts, buildAcceptances.ts) — the
// optional hide joins a member's siblings and full-suite excludes (issue #12). Record Build Acceptances example 9, then rows.
import { test, expect } from "vitest";
import { buildAcceptances } from "../../src/builder/buildAcceptances.js";
import { codeAcceptance } from "../../src/builder/compose.js";
import { goCodeAcceptance, goJudgeAcceptance } from "../../src/builder/goAcceptance.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { GO, TYPESCRIPT } from "../../src/language/profiles.js";
import type { BuildInput, CardContext, Checks } from "../../src/builder/types.js";
import type { Card } from "../../src/cards/types.js";

const card = (id: string, targets: string[], dependsOn: string[] = []): Card => ({ customId: id, intent: "generate", targets,
  contextSlice: [], instruction: "write " + targets[0], acceptance: null, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn });
const checks = (phase: string, ids: string[], fullExclude: string[]): Checks => ({ version: 1, phase, parts: "decks/" + phase + "/parts",
  frozen: DEFAULT_FROZEN, fullExclude, ownGit: false, cards: ids.map((id) => ({ id, smoke: null, extra: null, files: null })) });
const texts = (ids: string[], probe: string) => ({ guard: "// guard\n", firstdiff: "// firstdiff\n", probes: Object.fromEntries(ids.map((i) => [i, probe])) });
const ctx = (id: string, targets: string[], siblings: string[], fullExclude: string[], phase = "p9"): CardContext => ({ id, phase, targets, siblings,
  frozen: DEFAULT_FROZEN, fullExclude, ownGit: false, profile: GO, guard: "// guard\n", firstdiff: "// firstdiff\n", allowed: [], vendor: false });
const accOf = (r: ReturnType<typeof buildAcceptances>, id: string): string | null =>
  r.ok ? (r.cards.find((c) => c.customId === id)?.acceptance ?? null) : "errors: " + r.errors.join("; ");
const P = "package calc\n";

test("Build Acceptances example 9: hide joins siblings and fullExclude, each path once; a foreign key is ignored", () => {
  const input: BuildInput = { cards: [card("a", ["calc/a.go"]), card("b", ["calc/b.go"], ["a"]), card("c", ["report/c.go"], ["a"])],
    checks: checks("p9", ["a", "b", "c"], ["calc/old_test.go"]), profile: GO, texts: texts(["a", "b", "c"], P),
    hide: { a: ["calc/b.go", "report/c.go"], b: ["report/c.go", "calc/b_test.go"], zz: ["x.go"] } };
  const r = buildAcceptances(input);
  expect(accOf(r, "a")).toBe(goCodeAcceptance(ctx("a", ["calc/a.go"], ["calc/b.go", "report/c.go"], ["calc/old_test.go", "calc/b.go", "report/c.go"]), P, null, null));
  expect(accOf(r, "b")).toBe(goCodeAcceptance(ctx("b", ["calc/b.go"], ["report/c.go", "calc/b_test.go"], ["calc/old_test.go", "report/c.go", "calc/b_test.go"]), P, null, null));
  expect(accOf(r, "c")).toBe(goCodeAcceptance(ctx("c", ["report/c.go"], ["calc/b.go"], ["calc/old_test.go"]), P, null, null));
  const { hide: _drop, ...plain } = input;
  void _drop;
  const q = buildAcceptances(plain);
  expect(accOf(q, "a")).toBe(goCodeAcceptance(ctx("a", ["calc/a.go"], [], ["calc/old_test.go"]), P, null, null));
  expect(accOf(q, "b")).toBe(goCodeAcceptance(ctx("b", ["calc/b.go"], ["report/c.go"], ["calc/old_test.go"]), P, null, null));
  expect(input.checks.fullExclude).toStrictEqual(["calc/old_test.go"]);
});

test("row: a judge member, hide {} and an inherited key, a typescript member", () => {
  const files = [{ file: "calc/a_examples_test.go", min: 1, max: 7, lits: [], drop: [], new: true }];
  const ch: Checks = { ...checks("p8", ["a"], []), cards: [{ id: "a", smoke: null, extra: null, files: null }, { id: "a-judge", smoke: null, extra: null, files }] };
  const cards = [card("a", ["calc/a.go"]), card("a-judge", ["calc/a_examples_test.go"], ["a"])];
  const r = buildAcceptances({ cards, checks: ch, profile: GO, texts: texts(["a"], P), hide: { "a-judge": ["report/x.go", "report/x.go"], a: [] } });
  expect(accOf(r, "a-judge")).toBe(goJudgeAcceptance(ctx("a-judge", ["calc/a_examples_test.go"], ["report/x.go"], ["report/x.go"], "p8"), files));
  expect(accOf(r, "a")).toBe(goCodeAcceptance(ctx("a", ["calc/a.go"], [], [], "p8"), P, null, null));
  const inherited = Object.create({ a: ["calc/z.go"] }) as Record<string, string[]>;
  const s = buildAcceptances({ cards, checks: ch, profile: GO, texts: texts(["a"], P), hide: inherited });
  expect(accOf(s, "a")).toBe(goCodeAcceptance(ctx("a", ["calc/a.go"], [], [], "p8"), P, null, null));
  const t = buildAcceptances({ cards: [card("t", ["src/x/t.ts"]), card("u", ["src/x/u.ts"])], checks: checks("p7", ["t", "u"], []), profile: TYPESCRIPT,
    texts: { guard: "// guard\n", firstdiff: "// firstdiff\n", probes: { t: "// probe\n", u: "// probe\n" } },
    hide: { t: ["src/x/u.ts", "tests/x/old.test.ts"] } });
  expect(accOf(t, "t")).toBe(codeAcceptance({ ...ctx("t", ["src/x/t.ts"], ["src/x/u.ts", "tests/x/old.test.ts"], ["src/x/u.ts", "tests/x/old.test.ts"], "p7"), profile: TYPESCRIPT }, "// probe\n", null, null));
});
