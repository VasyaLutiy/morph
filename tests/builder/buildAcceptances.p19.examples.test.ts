import { expect, test } from "vitest";
import { buildAcceptances } from "../../src/builder/buildAcceptances.js";
import { codeAcceptance } from "../../src/builder/compose.js";
import { GO_ENV, GO_ENV_VENDOR, goJudgeAcceptance } from "../../src/builder/goAcceptance.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { GO, TYPESCRIPT } from "../../src/language/profiles.js";
import { fixture } from "../helpers.js";
import type { Card } from "../../src/cards/types.js";
import type {
  BuildInput,
  BuildResult,
  BuildTexts,
  CardContext,
  CheckCard,
  Checks,
  JudgeFile,
} from "../../src/builder/types.js";

const card = (id: string, targets: string[], dependsOn: string[] = []): Card => ({
  customId: id,
  intent: "patch",
  targets,
  contextSlice: [],
  instruction: "x",
  acceptance: null,
  model: null,
  maxTokens: null,
  reasoning: null,
  variants: 1,
  dependsOn,
});

const checks = (phase: string, cards: CheckCard[], frozen: string[] = DEFAULT_FROZEN): Checks => ({
  version: 1,
  phase,
  parts: "decks/" + phase + "/parts",
  frozen,
  fullExclude: [],
  ownGit: false,
  cards,
});

const codeCard = (id: string): CheckCard => ({ id, smoke: null, extra: null, files: null });

function acceptanceOf(result: BuildResult, id: string): string {
  if (!result.ok) {
    throw new Error("build acceptances failed: " + result.errors.join("; "));
  }
  const found = result.cards.find((c) => c.customId === id);
  if (found === undefined) {
    throw new Error("no card " + id);
  }
  if (found.acceptance === null) {
    throw new Error("no acceptance for " + id);
  }
  return found.acceptance;
}

test("Build Acceptances example 7: a card's own key in uses becomes its allowed list, absent uses and vendor leave today's bytes", () => {
  const texts: BuildTexts = {
    guard: "// guard\n",
    firstdiff: "// firstdiff\n",
    probes: { a: "// probe\n", b: "// probe\n" },
  };
  const cards = [card("a", ["src/x/a.ts"]), card("b", ["src/x/b.ts"])];
  const knobs = checks("p7", [codeCard("a"), codeCard("b")]);
  const declared: BuildInput = {
    cards,
    checks: knobs,
    profile: TYPESCRIPT,
    texts,
    uses: { a: ["zod", "yaml"], "a-judge": ["ajv"], c: ["x"] },
    vendor: true,
  };

  const aCtx: CardContext = {
    id: "a",
    phase: "p7",
    targets: ["src/x/a.ts"],
    siblings: ["src/x/b.ts"],
    frozen: DEFAULT_FROZEN,
    fullExclude: [],
    ownGit: false,
    profile: TYPESCRIPT,
    guard: "// guard\n",
    firstdiff: "// firstdiff\n",
    allowed: ["zod", "yaml"],
    vendor: true,
  };
  const bCtx: CardContext = {
    ...aCtx,
    id: "b",
    targets: ["src/x/b.ts"],
    siblings: ["src/x/a.ts"],
    allowed: [],
  };
  const aExpected = codeAcceptance(aCtx, "// probe\n", null, null);
  const bExpected = codeAcceptance(bCtx, "// probe\n", null, null);

  const result = buildAcceptances(declared);
  expect(acceptanceOf(result, "a")).toBe(aExpected);
  expect(aExpected.includes("node $P/guard.mjs src src/x/a.ts 'zod,yaml'\n")).toBe(true);
  expect(acceptanceOf(result, "b")).toBe(bExpected);
  expect(bExpected.includes("node $P/guard.mjs src src/x/b.ts\n")).toBe(true);

  const plain: BuildInput = { cards, checks: knobs, profile: TYPESCRIPT, texts };
  const withoutUses = buildAcceptances(plain);
  const aPlain = codeAcceptance({ ...aCtx, allowed: [], vendor: false }, "// probe\n", null, null);
  expect(acceptanceOf(withoutUses, "a")).toBe(aPlain);
  expect(aPlain.includes("node $P/guard.mjs src src/x/a.ts\n")).toBe(true);
  expect(acceptanceOf(withoutUses, "b")).toBe(bExpected);
});

test("Build Acceptances example 8: the go code card names its declared modules and vendors, the judge only vendors", () => {
  const texts: BuildTexts = {
    guard: "// guard\n",
    firstdiff: "// firstdiff\n",
    probes: { "percent-of": "package calc\n" },
  };
  const files: JudgeFile[] = [
    {
      file: "calc/clamp_value_examples_test.go",
      min: 4,
      max: 10,
      lits: ["TestClampValueExample1"],
      drop: [],
      new: true,
    },
  ];
  const declared: BuildInput = {
    cards: [
      card("percent-of", ["calc/percent_of.go"]),
      card("clamp-value-judge", ["calc/clamp_value_examples_test.go"]),
    ],
    checks: checks(
      "m1",
      [codeCard("percent-of"), { id: "clamp-value-judge", smoke: null, extra: null, files }],
      ["go.mod", "internal"],
    ),
    profile: GO,
    texts,
    uses: { "percent-of": ["github.com/dustin/go-humanize", "golang.org/x/text"] },
    vendor: true,
  };

  const codeExpected = fixture("builder/go/code1.txt")
    .replace("export GOFLAGS=-mod=mod ", "export GOFLAGS=-mod=vendor ")
    .replace(
      "node $P/guard.mjs src calc/percent_of.go",
      "node $P/guard.mjs src calc/percent_of.go 'github.com/dustin/go-humanize,golang.org/x/text'",
    );

  const judgeCtx: CardContext = {
    id: "clamp-value-judge",
    phase: "m1",
    targets: ["calc/clamp_value_examples_test.go"],
    siblings: ["calc/percent_of.go"],
    frozen: ["go.mod", "internal"],
    fullExclude: [],
    ownGit: false,
    profile: GO,
    guard: "// guard\n",
    firstdiff: "// firstdiff\n",
    vendor: true,
  };
  const judgeExpected = goJudgeAcceptance(judgeCtx, files);

  const result = buildAcceptances(declared);
  expect(acceptanceOf(result, "percent-of")).toBe(codeExpected);
  expect(codeExpected.includes(GO_ENV_VENDOR)).toBe(true);
  expect(codeExpected.includes(GO_ENV)).toBe(false);
  expect(acceptanceOf(result, "clamp-value-judge")).toBe(judgeExpected);
  expect(judgeExpected.includes(GO_ENV_VENDOR)).toBe(true);
  expect(judgeExpected.includes("-mod=mod")).toBe(false);
});
