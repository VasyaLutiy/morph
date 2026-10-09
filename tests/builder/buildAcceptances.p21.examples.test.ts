import { expect, test } from "vitest";
import { buildAcceptances } from "../../src/builder/buildAcceptances.js";
import { goCodeAcceptance } from "../../src/builder/goAcceptance.js";
import { DEFAULT_FROZEN } from "../../src/builder/readChecks.js";
import { GO } from "../../src/language/profiles.js";
import type { Card } from "../../src/cards/types.js";
import type { BuildInput, CardContext, Checks } from "../../src/builder/types.js";

const card = (id: string, targets: string[], dependsOn: string[] = []): Card => ({
  customId: id,
  intent: "generate",
  targets,
  contextSlice: [],
  instruction: "write " + targets[0],
  acceptance: null,
  model: null,
  maxTokens: null,
  reasoning: null,
  variants: 1,
  dependsOn,
});

const ctx = (
  id: string,
  targets: string[],
  siblings: string[],
  fullExclude: string[],
): CardContext => ({
  id,
  phase: "p9",
  targets,
  siblings,
  frozen: DEFAULT_FROZEN,
  fullExclude,
  ownGit: false,
  profile: GO,
  guard: "// guard\n",
  firstdiff: "// firstdiff\n",
  allowed: [],
  vendor: false,
});

const cards: Card[] = [
  card("a", ["calc/a.go"]),
  card("b", ["calc/b.go"], ["a"]),
  card("c", ["report/c.go"], ["a"]),
];

const checks: Checks = {
  version: 1,
  phase: "p9",
  parts: "decks/p9/parts",
  frozen: DEFAULT_FROZEN,
  fullExclude: ["calc/old_test.go"],
  ownGit: false,
  cards: [
    { id: "a", smoke: null, extra: null, files: null },
    { id: "b", smoke: null, extra: null, files: null },
    { id: "c", smoke: null, extra: null, files: null },
  ],
};

const texts = {
  guard: "// guard\n",
  firstdiff: "// firstdiff\n",
  probes: { a: "package calc\n", b: "package calc\n", c: "package calc\n" },
};

const hide: Record<string, string[]> = {
  a: ["calc/b.go", "report/c.go"],
  b: ["report/c.go", "calc/b_test.go"],
  zz: ["x.go"],
};

test("Build Acceptances example 9: hide folds a member's paths into its siblings and fullExclude, a key that is no member is ignored, and no hide is byte for byte", () => {
  const hidden: BuildInput = { cards, checks, profile: GO, texts, hide };
  const result = buildAcceptances(hidden);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.errors.join("; "));
  const withHide = new Map(result.cards.map((c) => [c.customId, c.acceptance]));
  expect(withHide.get("a")).toBe(
    goCodeAcceptance(
      ctx(
        "a",
        ["calc/a.go"],
        ["calc/b.go", "report/c.go"],
        ["calc/old_test.go", "calc/b.go", "report/c.go"],
      ),
      "package calc\n",
      null,
      null,
    ),
  );
  expect(withHide.get("b")).toBe(
    goCodeAcceptance(
      ctx(
        "b",
        ["calc/b.go"],
        ["report/c.go", "calc/b_test.go"],
        ["calc/old_test.go", "report/c.go", "calc/b_test.go"],
      ),
      "package calc\n",
      null,
      null,
    ),
  );
  expect(withHide.get("c")).toBe(
    goCodeAcceptance(
      ctx("c", ["report/c.go"], ["calc/b.go"], ["calc/old_test.go"]),
      "package calc\n",
      null,
      null,
    ),
  );

  const plain: BuildInput = { cards, checks, profile: GO, texts };
  const bare = buildAcceptances(plain);
  expect(bare.ok).toBe(true);
  if (!bare.ok) throw new Error(bare.errors.join("; "));
  const withoutHide = new Map(bare.cards.map((c) => [c.customId, c.acceptance]));
  expect(withoutHide.get("a")).toBe(
    goCodeAcceptance(
      ctx("a", ["calc/a.go"], [], ["calc/old_test.go"]),
      "package calc\n",
      null,
      null,
    ),
  );
  expect(withoutHide.get("b")).toBe(
    goCodeAcceptance(
      ctx("b", ["calc/b.go"], ["report/c.go"], ["calc/old_test.go"]),
      "package calc\n",
      null,
      null,
    ),
  );
  expect(withoutHide.get("c")).toBe(
    goCodeAcceptance(
      ctx("c", ["report/c.go"], ["calc/b.go"], ["calc/old_test.go"]),
      "package calc\n",
      null,
      null,
    ),
  );
});
