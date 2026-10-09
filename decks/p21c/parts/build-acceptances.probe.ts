// P21c probe for build-acceptances by docs/TASK_P21c_transaction.md §2.2 (src/builder/types.ts, src/builder/buildAcceptances.ts)
// — transaction: true (an --only cut) builds every member with no siblings and no hide, marks it with TRANSACTION_MARK and
// lets its untracked step accept every member's targets. Record Build Acceptances example 10, then rows.
import { test, expect } from "vitest";
import { buildAcceptances } from "../../src/builder/buildAcceptances.js";
import { codeAcceptance, judgeAcceptance } from "../../src/builder/compose.js";
import { untrackedStep } from "../../src/builder/steps.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { GO, TYPESCRIPT } from "../../src/language/profiles.js";
import { TRANSACTION_MARK } from "../../src/cards/transaction.js";
import type { BuildInput, CardContext, Checks, JudgeFile } from "../../src/builder/types.js";
import type { Card } from "../../src/cards/types.js";
import { fixture } from "../../tests/helpers.js";

const card = (id: string, targets: string[], dependsOn: string[] = []): Card => ({ customId: id, intent: "generate", targets, contextSlice: [],
  instruction: "w", acceptance: null, model: null, maxTokens: null, reasoning: null, variants: 1, dependsOn });
const files: JudgeFile[] = [{ file: "tests/x/a.examples.test.ts", min: 1, max: 4, lits: [], drop: [], new: true }];
const checks: Checks = { version: 1, phase: "p8", parts: "decks/p8/parts", frozen: DEFAULT_FROZEN, fullExclude: ["tests/x/old.test.ts"], ownGit: false,
  cards: [{ id: "a", smoke: null, extra: null, files: null }, { id: "b", smoke: null, extra: null, files: null }, { id: "j", smoke: null, extra: null, files }] };
const cards: Card[] = [card("a", ["src/x/a.ts"]), card("b", ["src/x/b.ts"]), card("j", ["tests/x/a.examples.test.ts"], ["a"])];
const texts = { guard: "// guard\n", firstdiff: "// firstdiff\n", probes: { a: "// probe\n", b: "// probe\n" } };
const base: BuildInput = { cards, checks, profile: TYPESCRIPT, texts };
const ctx = (id: string, targets: string[]): CardContext => ({ id, phase: "p8", targets, siblings: [], frozen: DEFAULT_FROZEN,
  fullExclude: ["tests/x/old.test.ts"], ownGit: false, profile: TYPESCRIPT, guard: "// guard\n", firstdiff: "// firstdiff\n", allowed: [], vendor: false });
const ALL = ["src/x/a.ts", "src/x/b.ts", "tests/x/a.examples.test.ts"];
const M = TRANSACTION_MARK + "\n";
const accOf = (r: ReturnType<typeof buildAcceptances>, id: string): string => (r.ok ? (r.cards.find((c) => c.customId === id)?.acceptance ?? "") : "not ok");

test("Build Acceptances example 10: transaction marks every member, no siblings, hide ignored, one untracked step for all", () => {
  const r = buildAcceptances({ ...base, transaction: true, hide: { a: ["src/x/b.ts"] } });
  expect(r.ok).toBe(true);
  expect(accOf(r, "a")).toBe(M + codeAcceptance(ctx("a", ["src/x/a.ts"]), "// probe\n", null, null).replace(untrackedStep(["src/x/a.ts"]), () => untrackedStep(ALL)));
  expect(accOf(r, "b")).toBe(M + codeAcceptance(ctx("b", ["src/x/b.ts"]), "// probe\n", null, null).replace(untrackedStep(["src/x/b.ts"]), () => untrackedStep(ALL)));
  expect(accOf(r, "j")).toBe(M + judgeAcceptance(ctx("j", ["tests/x/a.examples.test.ts"]), files).replace(untrackedStep(["tests/x/a.examples.test.ts"]), () => untrackedStep(ALL)));
  const off = buildAcceptances({ ...base, transaction: false });
  expect(JSON.stringify(off)).toBe(JSON.stringify(buildAcceptances(base)));
  expect(accOf(off, "a").includes("src/x/b.ts")).toBe(true);
  const gcards = [card("percent-of", ["calc/percent_of.go"]), card("clamp-value-judge", ["calc/clamp_value_examples_test.go"])];
  const gchecks: Checks = { version: 1, phase: "m1", parts: "decks/m1/parts", frozen: ["go.mod", "internal"], fullExclude: [], ownGit: false,
    cards: [{ id: "percent-of", smoke: null, extra: null, files: null }, { id: "clamp-value-judge", smoke: null, extra: null,
      files: [{ file: "calc/clamp_value_examples_test.go", min: 4, max: 10, lits: ["TestClampValueExample1"], drop: [], new: true }] }] };
  const g = buildAcceptances({ cards: gcards, checks: gchecks, profile: GO, texts: { guard: "// guard\n", firstdiff: "// firstdiff\n", probes: { "percent-of": "package calc\n" } }, transaction: true });
  expect(accOf(g, "percent-of")).toBe(M + fixture("builder/go/code1.txt").replace('{"Replace":{"calc/clamp_value_examples_test.go":""}}', '{"Replace":{}}')
    .replace("-e calc/percent_of.go ||", "-e calc/percent_of.go -e calc/clamp_value_examples_test.go ||"));
});

test("row: the untracked step lists every member once in the checks' order, a non-member untouched, the input unchanged", () => {
  const c2 = [card("z", ["src/x/z.ts"]), card("a", ["src/x/a.ts"]), card("b", ["src/x/b.ts"])];
  const ch: Checks = { ...checks, cards: [{ id: "b", smoke: null, extra: null, files: null }, { id: "a", smoke: null, extra: null, files: null }] };
  const before = JSON.stringify(c2) + JSON.stringify(ch);
  const r = buildAcceptances({ cards: c2, checks: ch, profile: TYPESCRIPT, texts, transaction: true });
  expect(accOf(r, "a").includes(untrackedStep(["src/x/b.ts", "src/x/a.ts"]))).toBe(true);
  expect(accOf(r, "a").split("git ls-files --others").length - 1).toBe(1);
  expect([r.ok ? r.cards[0].acceptance : "x", JSON.stringify(c2) + JSON.stringify(ch)]).toStrictEqual([null, before]);
  expect(accOf(r, "b").startsWith(M + "D=/tmp/morph/b-p8;")).toBe(true);
});
