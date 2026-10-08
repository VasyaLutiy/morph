import { expect, test } from "vitest";
import { planCommand } from "../../src/cli/planCommand.js";
import { fixture, tmpRoot } from "../helpers.js";
import type { Card } from "../../src/cards/types.js";
import type { PlanArgs, PlanDocument } from "../../src/cli/types.js";
import type { TmpRoot } from "../helpers.js";

const MINI = ["contour.yaml", "morph-map.json", "go.mod", "internal/testhelp/testhelp.go", "decks/m1/checks.json",
  "decks/m1/parts/_clamp-value_probe_test.go", "decks/m1/parts/_percent-of_probe_test.go", "decks/m1/parts/_format-share_probe_test.go"];

function miniRoot(map: string | null): TmpRoot {
  const r = tmpRoot();
  for (const f of MINI) r.write(f, fixture("go-mini/" + f));
  if (map !== null) r.write("morph-map.json", fixture(map));
  r.write("decks/tools/guard.mjs", "// guard\n");
  r.write("decks/tools/firstdiff.mjs", "// firstdiff\n");
  return r;
}

const args = (over: Partial<PlanArgs>): PlanArgs => ({ name: "plan", root: ".", pretty: false, spec: "contour.yaml",
  map: "morph-map.json", components: ["calc", "report"], judge: true, out: "decks/m1/deck.json", checks: "decks/m1/checks.json", ...over });

function cardOf(cards: readonly Card[], id: string): Card {
  const found = cards.find((c) => c.customId === id);
  if (found === undefined) throw new Error("the deck has no card " + id);
  return found;
}

test("Plan Command example 12: --only recomputes the overlay against the current tree", () => {
  const r = miniRoot("cli/goMini.sameGen.map.json");
  try {
    const first = planCommand(r.root, args({}));
    expect(first.code).toBe(0);
    const full = first.document as PlanDocument;
    expect(full.generations).toStrictEqual([
      ["clamp-value", "percent-of"],
      ["clamp-value-judge", "format-share", "percent-of-judge"],
      ["format-share-judge"],
    ]);
    const overlay = '{"Replace":{"calc/clamp_value.go":""}}';
    const percentOf = cardOf(full.cards, "percent-of");
    expect((percentOf.acceptance ?? "").split(overlay).length - 1).toBe(1);

    const second = planCommand(r.root, args({ only: ["percent-of"], out: "decks/m1/only.json" }));
    expect(second.code).toBe(0);
    const only = second.document as PlanDocument;
    expect(only.generations).toStrictEqual([["percent-of"]]);
    expect(only.externalDependsOn).toStrictEqual({});
    expect(only.cards).toStrictEqual([
      { ...percentOf, acceptance: (percentOf.acceptance ?? "").replace(overlay, '{"Replace":{}}') },
    ]);
    expect(only.out).toBe("decks/m1/only.json");
    expect(r.read("decks/m1/only.json")).toBe(JSON.stringify(only.cards, null, 2) + "\n");
  } finally {
    r.rm();
  }
});

test("Plan Command example 13: --only keeps two siblings that still hide each other", () => {
  const r = miniRoot(null);
  try {
    const fullDeck = JSON.parse(fixture("cli/goMini.deck.json")) as Card[];

    const two = planCommand(r.root, args({ only: ["percent-of-judge", "format-share"], out: "decks/m1/two.json" }));
    expect(two.code).toBe(0);
    const cut = two.document as PlanDocument;
    expect(cut.generations).toStrictEqual([["format-share", "percent-of-judge"]]);
    expect(cut.externalDependsOn).toStrictEqual({
      "format-share": ["percent-of"],
      "percent-of-judge": ["percent-of"],
    });
    expect(cut.cards).toStrictEqual([cardOf(fullDeck, "format-share"), cardOf(fullDeck, "percent-of-judge")]);

    const bad = planCommand(r.root, args({ only: ["nope", "percent-of", "x.2"], out: "decks/m1/bad.json" }));
    expect(bad.code).toBe(2);
    expect(bad.document).toStrictEqual({
      error: { code: 2, kind: "DeckError", message: "--only names cards the plan does not have: nope, x.2" },
    });
    expect(r.exists("decks/m1/bad.json")).toBe(false);

    const base = planCommand(r.root, args({ checks: undefined, out: null }));
    expect(base.code).toBe(0);
    const clamp = planCommand(r.root, args({ only: ["clamp-value"], checks: undefined, out: null }));
    expect(clamp.code).toBe(0);
    const clampDoc = clamp.document as PlanDocument;
    expect(clampDoc.generations).toStrictEqual([["clamp-value"]]);
    expect(clampDoc.cards).toStrictEqual([cardOf((base.document as PlanDocument).cards, "clamp-value")]);
  } finally {
    r.rm();
  }
});
