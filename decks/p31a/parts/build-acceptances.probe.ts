// P31a probe for build-acceptances by docs/TASK_P31a_guardrails.md §2.2 (src/builder/types.ts, buildAcceptances.ts) —
// issue #42: an input rules gives every member's ctx its Card Rules, after layers. Record Build Acceptances example 12.
import { test, expect } from "vitest";
import { buildAcceptances } from "../../src/builder/buildAcceptances.js";
import { codeAcceptance, judgeAcceptance } from "../../src/builder/compose.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { GO, TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture } from "../../tests/helpers.js";
import type { Card } from "../../src/cards/types.js";
import type { BuildInput, BuildResult, CardContext, Checks, JudgeFile } from "../../src/builder/types.js";

const card = (id: string, targets: string[], dependsOn: string[] = []): Card => ({
  customId: id, intent: "patch", targets, contextSlice: [], instruction: "x", acceptance: null, model: null,
  maxTokens: null, reasoning: null, variants: 1, dependsOn,
});
const acc = (r: BuildResult, id: string): string => {
  if (!r.ok) throw new Error("not ok: " + r.errors.join("; "));
  return r.cards.find((c) => c.customId === id)?.acceptance ?? "";
};
const files: JudgeFile[] = [{ file: "tests/x/a.examples.test.ts", min: 1, max: 4, lits: [], drop: [], new: true }];
const checks: Checks = {
  version: 1, phase: "p30", parts: "decks/p30/parts", frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false,
  cards: [{ id: "a", smoke: null, extra: null, files: null }, { id: "j", smoke: null, extra: null, files }],
};
const ts = (): BuildInput => ({
  cards: [card("a", ["src/x/a.ts"]), card("j", ["tests/x/a.examples.test.ts"], ["a"])],
  checks, profile: TYPESCRIPT,
  texts: { guard: "// guard\n", firstdiff: "// firstdiff\n", probes: { a: "// probe\n" } },
  uses: { a: ["zod"] },
});
const ctx = (over: Partial<CardContext>): CardContext => ({
  id: "a", phase: "p30", targets: ["src/x/a.ts"], siblings: [], frozen: DEFAULT_FROZEN, fullExclude: [], ownGit: false,
  profile: TYPESCRIPT, guard: "// guard\n", firstdiff: "// firstdiff\n", allowed: ["zod"], vendor: false, ...over,
});

const PURE = "Guardrail 'Pure' of Component x";

test("Build Acceptances example 12: rules reach each code card's guard line as Card Rules, after the layers", () => {
  const layers = { "src/x": ["src/y"], "src/z": [] };
  const withRules = buildAcceptances({ ...ts(), layers, rules: { "src/x": { pure: PURE }, "src/z": {} } });
  const a = acc(withRules, "a");
  expect(a).toBe(codeAcceptance(ctx({ layers: { "src/x": ["src/y"] }, rules: { "src/x": { pure: PURE } } }), "// probe\n", null, null));
  expect(a).toContain("node $P/guard.mjs src src/x/a.ts 'zod' '{\"src/x\":[\"src/y\"]}' '{\"src/x\":{\"pure\":\"Guardrail \\u0027Pure\\u0027 of Component x\"}}'\n");
  const layersOnly = buildAcceptances({ ...ts(), layers });
  expect(acc(withRules, "j")).toBe(acc(layersOnly, "j"));
  expect(acc(layersOnly, "a")).toContain("node $P/guard.mjs src src/x/a.ts 'zod' '{\"src/x\":[\"src/y\"]}'\n");
  const go = buildAcceptances({
    cards: [card("percent-of", ["calc/percent_of.go"]), card("clamp-value-judge", ["calc/clamp_value_examples_test.go"])],
    checks: {
      version: 1, phase: "m1", parts: "decks/m1/parts", frozen: ["go.mod", "internal"], fullExclude: [], ownGit: false,
      cards: [
        { id: "percent-of", smoke: null, extra: null, files: null },
        { id: "clamp-value-judge", smoke: null, extra: null, files: [{ file: "calc/clamp_value_examples_test.go", min: 4, max: 10, lits: ["TestClampValueExample1"], drop: [], new: true }] },
      ],
    },
    profile: GO,
    texts: { guard: "// guard\n", firstdiff: "// firstdiff\n", probes: { "percent-of": "package calc\n" } },
    layers: { calc: ["report"] },
    rules: { calc: { "no-shell": "Guardrail 'No Shell' of System m" } },
  });
  const line = "echo '== guard'; node $P/guard.mjs src calc/percent_of.go";
  expect(acc(go, "percent-of")).toBe(fixture("builder/go/code1.txt").replace(line, line + " '' '{\"calc\":[\"report\"]}' '{\"calc\":{\"no-shell\":\"Guardrail \\u0027No Shell\\u0027 of System m\"}}'"));
});
