// P19b probe for build-acceptances by docs/TASK_P19b_deps.md §2.2 (src/builder/buildAcceptances.ts) — the input's
// uses and vendor reach every member's Card Context: allowed = uses[customId] as given (own keys only), vendor for every
// member; without them every acceptance byte for byte (issue #10). Record Build Acceptances 2, 7, 8, then rows.
import { test, expect } from "vitest";
import { buildAcceptances } from "../../src/builder/buildAcceptances.js";
import { codeAcceptance } from "../../src/builder/compose.js";
import { GO_ENV, GO_ENV_VENDOR, goJudgeAcceptance } from "../../src/builder/goAcceptance.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { GO, TYPESCRIPT } from "../../src/language/profiles.js";
import type { BuildInput, BuildResult, CardContext, Checks, JudgeFile } from "../../src/builder/types.js";
import type { Card } from "../../src/cards/types.js";
import { fixture } from "../../tests/helpers.js";

const card = (id: string, targets: string[], dependsOn: string[] = []): Card => ({
  customId: id, intent: "patch", targets, contextSlice: [], instruction: "x", acceptance: null, model: null,
  maxTokens: null, reasoning: null, variants: 1, dependsOn,
});
const checks = (phase: string, cards: Checks["cards"], frozen: string[] = DEFAULT_FROZEN): Checks => ({
  version: 1, phase, parts: "decks/" + phase + "/parts", frozen, fullExclude: [], ownGit: false, cards,
});
const code = (id: string): Checks["cards"][number] => ({ id, smoke: null, extra: null, files: null });
const TEXTS = { guard: "// guard\n", firstdiff: "// firstdiff\n" };
const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "a", phase: "p7", targets: ["src/x/a.ts"], siblings: [], frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false,
  profile: TYPESCRIPT, ...TEXTS, ...over,
});
const acc = (r: BuildResult): Record<string, string | null> => {
  if (!r.ok) throw new Error(r.errors.join("; "));
  return Object.fromEntries(r.cards.map((c) => [c.customId, c.acceptance]));
};
const TS_INPUT: BuildInput = {
  cards: [card("a", ["src/x/a.ts"]), card("b", ["src/x/b.ts"])], checks: checks("p7", [code("a"), code("b")]), profile: TYPESCRIPT,
  texts: { ...TEXTS, probes: { a: "// probe\n", b: "// probe\n" } },
};
const GO_FILES: JudgeFile[] = [{ file: "calc/clamp_value_examples_test.go", min: 4, max: 10, lits: ["TestClampValueExample1"], drop: [], new: true }];
const GO_INPUT: BuildInput = {
  cards: [card("percent-of", ["calc/percent_of.go"]), card("clamp-value-judge", ["calc/clamp_value_examples_test.go"])],
  checks: checks("m1", [code("percent-of"), { id: "clamp-value-judge", smoke: null, extra: null, files: GO_FILES }], ["go.mod", "internal"]),
  profile: GO, texts: { ...TEXTS, probes: { "percent-of": "package calc\n" } },
};
const once = (text: string, from: string, to: string): string => {
  expect([from, text.split(from).length - 1]).toStrictEqual([from, 1]);
  return text.replace(from, to);
};

test("row: without uses and vendor the members as before (example 2 shape)", () => {
  const a = acc(buildAcceptances(TS_INPUT));
  expect(a).toStrictEqual({ a: codeAcceptance(ctx({ siblings: ["src/x/b.ts"] }), "// probe\n", null, null),
    b: codeAcceptance(ctx({ id: "b", targets: ["src/x/b.ts"], siblings: ["src/x/a.ts"] }), "// probe\n", null, null) });
});

test("Build Acceptances example 7: uses and vendor on a typescript deck", () => {
  const a = acc(buildAcceptances({ ...TS_INPUT, uses: { a: ["zod", "yaml"], "a-judge": ["ajv"], c: ["x"] }, vendor: true }));
  expect(a.a).toBe(codeAcceptance(ctx({ siblings: ["src/x/b.ts"], allowed: ["zod", "yaml"] }), "// probe\n", null, null));
  expect(a.a?.includes("node $P/guard.mjs src src/x/a.ts 'zod,yaml'\n")).toBe(true);
  expect(a.b).toBe(codeAcceptance(ctx({ id: "b", targets: ["src/x/b.ts"], siblings: ["src/x/a.ts"] }), "// probe\n", null, null));
  expect(a.b?.includes("node $P/guard.mjs src src/x/b.ts\n")).toBe(true);
  const plain = acc(buildAcceptances(TS_INPUT));
  expect([plain.a?.includes("node $P/guard.mjs src src/x/a.ts\n"), plain.b]).toStrictEqual([true, a.b]);
});

test("Build Acceptances example 8: uses and vendor on a go deck", () => {
  const a = acc(buildAcceptances({ ...GO_INPUT, uses: { "percent-of": ["github.com/dustin/go-humanize", "golang.org/x/text"] }, vendor: true }));
  expect(a["percent-of"]).toBe(once(once(fixture("builder/go/code1.txt"), GO_ENV, GO_ENV_VENDOR), "node $P/guard.mjs src calc/percent_of.go\n",
    "node $P/guard.mjs src calc/percent_of.go 'github.com/dustin/go-humanize,golang.org/x/text'\n"));
  const jctx: CardContext = { id: "clamp-value-judge", phase: "m1", targets: ["calc/clamp_value_examples_test.go"], siblings: ["calc/percent_of.go"],
    frozen: ["go.mod", "internal"], fullExclude: [], ownGit: false, profile: GO, ...TEXTS, vendor: true };
  expect(a["clamp-value-judge"]).toBe(goJudgeAcceptance(jctx, GO_FILES));
  expect([a["clamp-value-judge"]?.includes("export GOFLAGS=-mod=vendor "), a["clamp-value-judge"]?.includes("-mod=mod")]).toStrictEqual([true, false]);
});

test("row: own keys only, the list as given, vendor false or absent the same, a go deck without uses byte for byte", () => {
  const proto = acc(buildAcceptances({ ...TS_INPUT, cards: [card("constructor", ["src/x/a.ts"]), card("b", ["src/x/b.ts"])],
    checks: checks("p7", [code("constructor"), code("b")]), texts: { ...TEXTS, probes: { constructor: "// probe\n", b: "// probe\n" } }, uses: {} }));
  expect(proto.constructor?.includes("node $P/guard.mjs src src/x/a.ts\n")).toBe(true);
  const kept = acc(buildAcceptances({ ...TS_INPUT, uses: { b: ["z", "a", "z"] }, vendor: false }));
  expect([kept.a?.includes("guard.mjs src src/x/a.ts\n"), kept.b?.includes("guard.mjs src src/x/b.ts 'z,a,z'\n")]).toStrictEqual([true, true]);
  const go = acc(buildAcceptances(GO_INPUT));
  expect(go["percent-of"]).toBe(fixture("builder/go/code1.txt"));
  expect(acc(buildAcceptances({ ...GO_INPUT, uses: {}, vendor: false }))).toStrictEqual(go);
  const vend = acc(buildAcceptances({ ...GO_INPUT, vendor: true }));
  expect(vend["percent-of"]).toBe(once(fixture("builder/go/code1.txt"), GO_ENV, GO_ENV_VENDOR));
});
